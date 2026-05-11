# Zarya Standalone — DAO UI Implementation Plan

## Current state

- [x] Electron + Vite + TypeScript scaffold
- [x] Light/dark theme toggle
- [x] EN/RU i18n
- [x] Key generation (AES-256-GCM + scrypt)
- [x] Key unlock
- [x] Keystore export / import
- [x] Wallet view (address display)

---

## Phase 1 — Network configuration

> Goal: let the user point the app at a deployed `Zarya.sol` instance.

### 1.1 RPC URL — build-time constant (hidden)

The RPC URL is **not stored in any file accessible at runtime**. It is injected at build time via a `.env` file and Vite's `define`:

```
# .env  (git-ignored)
VITE_RPC_URL=https://your-rpc-endpoint
```

```ts
// vite.main.config.ts
import { defineConfig, loadEnv } from 'vite'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    define: {
      __RPC_URL__: JSON.stringify(env.VITE_RPC_URL),
    },
  }
})
```

In the main process: `const RPC_URL = __RPC_URL__` — inlined into the asar bundle at compile time. Never sent to the renderer, never written to disk.

### 1.2 Config file (`userData/config.json`)

Stores only deployment-specific fields the operator may need to change without rebuilding:
- `contractAddress: string` (`0x…`)
- `chainId: number`

### 1.3 `configManager.ts` (main process)

- `readConfig(): Config | null`
- `writeConfig(config: Config): void`

### 1.4 IPC

| Channel | Direction | Description |
|---|---|---|
| `config:read` | main → renderer | Returns current config or `null` |
| `config:write` | renderer → main | Persists new config |
| `config:test` | renderer → main | Calls `eth_chainId` using hardcoded RPC to verify chain |

### 1.5 Settings view (UI)

- Contract address input
- Chain ID input (auto-filled from `config:test`)
- Save button → validates → navigates to Dashboard
- **No RPC URL field** — not visible to the user

---

## Phase 2 — Contract read/write layer

> Goal: generic IPC bridge between renderer and `Zarya.sol` via viem.

### 2.1 `zaryaClient.ts` (main process)

Uses viem directly — already a dependency via `viem/accounts` in `keyManager.ts`.

```ts
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { defineChain } from 'viem'

// Built once from config.json on first read call
const publicClient = createPublicClient({
  chain: defineChain({ id: chainId, ... }),
  transport: http(rpcUrl),
})

// Built in-memory after key:unlock — holds the decrypted privateKey
// Never serialised or sent to renderer
const walletClient = createWalletClient({
  account: privateKeyToAccount(decryptedPrivateKey),
  chain: ...,
  transport: http(rpcUrl),
})
```

Reads use `publicClient.readContract({ address, abi: zaryaAbi, functionName, args })`.  
Writes use `walletClient.writeContract(...)` + `publicClient.waitForTransactionReceipt({ hash })`.

The wallet client is created in-memory after `key:unlock` succeeds and destroyed on app quit. The private key never leaves the main process.

### 2.2 IPC handlers

| Channel | Args | Returns |
|---|---|---|
| `zarya:read` | `{ fn, args }` | ABI-decoded result via `readContract` |
| `zarya:write` | `{ fn, args }` | tx hash via `writeContract` |
| `zarya:waitTx` | `txHash` | receipt via `waitForTransactionReceipt` |

### 2.3 Preload additions

```ts
zaryaAPI: {
  read(fn, args): Promise<unknown>
  write(fn, args): Promise<`0x${string}`>
  waitTx(hash): Promise<TransactionReceipt>
}
configAPI: {
  read(): Promise<Config | null>
  write(c: Config): Promise<void>
  test(rpcUrl, chainId): Promise<boolean>
}
```

---

## Phase 3 — Dashboard

> Goal: landing page after unlock when config exists.

### Views shown

- Connected address
- Connected network (chain name + block number)
- Membership status — list of organs the address belongs to (calls `isMember` for known organs stored in config or discovered)
- Badge: number of active votings

### Navigation

```
Dashboard
├── [Matrix] button → Matrix view
├── [Votings] button → Votings view
└── [Settings] button → Settings view
```

---

## Phase 4 — Votings

> Goal: view and participate in DAO votings.

### 4.1 Votings list view

- Fetches `nextVotingId` → iterates `getVotingResults(id)` for all IDs
- Two tabs: **Active** (`isVotingActive`) | **Past** (`isVotingFinalized`)
- Each row: voting type, organ identifier, deadline countdown, for/against counts
- [Cast Vote] button — shown only if:
  - voting is active
  - user is a member of the organ
  - user hasn't voted yet (`hasVoted`)

### 4.2 Cast vote

- Confirm dialog (for / against toggle)
- Calls `zarya:write` → `castVote(votingId, support, organ)`
- Shows tx hash + waits for receipt

### 4.3 Execute voting

- Shown on past, non-finalized votings
- Input fields: minimum quorum, minimum approval %
- Calls `zarya:write` → `executeVoting(votingId, quorum, approval%)`

---

## Phase 5 — Opinion matrix browser

> Goal: read and explore the opinion matrix M = (S_X, S_Y).

### 5.1 Matrix view

- Toggle: **S_X** (numerical) | **S_Y** (categorical)
- Table: rows = themes (`getTheme`), columns = statements (`getStatement`)
- Each cell shows organ code + sample length
- Click → Cell detail view

### 5.2 Cell detail view

- Organ responsible (`getCategoricalCellOrgan` / `getNumericalCellOrgan`)
- Paginated history (`getCategoricalHistory` / `getNumericalHistory`)
  - timestamp, author address, value
- Aggregated opinion (computed off-chain):
  - **S_X**: mean, 95% confidence interval
  - **S_Y**: mode, frequency distribution bar chart
- [Propose value] button → Create voting view (pre-filled context)

---

## Phase 6 — Create voting

> Goal: allow organ members to initiate any voting type.

### 6.1 Voting type selector

| Type | Required membership |
|---|---|
| `NumericalValueVoting` | organ member |
| `CategoricalValueVoting` | organ member |
| `CategoryVoting` | organ member |
| `DecimalsVoting` | organ member |
| `MembershipVoting` | organ member or Chairman |
| `MembershipRevocationVoting` | organ member or Chairman |
| `ThemeVoting` | any participant |
| `StatementVoting` | any participant |

### 6.2 Organ picker

- Dropdowns: organ type → region (enum) → MO number
- Resolves to `PartyOrgan` bytes32 via `getPartyOrgan(type, region, number)`
- Shows human-readable identifier via `getPartyOrganIdentifier`

### 6.3 Form fields (contextual per type)

- x / y coordinates (matrix cell)
- value (uint64 for numerical; category uint64 for categorical)
- valueAuthor address
- categoryName string
- duration (seconds, shown as human-readable picker)

### 6.4 Submit flow

1. Validate inputs
2. Call `zarya:write` with appropriate `create*Voting` function
3. Show tx hash → wait for receipt → show new voting ID

---

## Phase 7 — Polish

- [ ] Error boundary: if `zarya:read` fails (RPC down), show banner
- [ ] Loading skeletons for async reads
- [ ] Organ membership discovery: scan known organs from config whitelist
- [ ] Offline mode: disable write buttons, show "read-only" badge
- [ ] Voting countdown timers (live, updated every second)
- [ ] Aggregation: off-chain mean/CI/mode computed in renderer TS, no new deps

---

## File structure (additions)

```
.env                         # git-ignored — contains VITE_RPC_URL
.env.example                 # committed — template with placeholder
src/
  configManager.ts           # Phase 1
  zaryaClient.ts             # Phase 2
  views/
    settings.ts              # Phase 1
    dashboard.ts             # Phase 3
    votings.ts               # Phase 4
    matrix.ts                # Phase 5
    cellDetail.ts            # Phase 5
    createVoting.ts          # Phase 6
  components/
    organPicker.ts           # Phase 6
    aggregation.ts           # Phase 7 (pure functions, no side effects)
```

All new views follow the existing pattern: hidden `div.view` in HTML, shown via `show(id)`.

---

## Dependencies needed

| Package | Purpose | Already present |
|---|---|---|
| `viem` | RPC client + signing | ✅ (used in keyManager) |

No additional runtime dependencies required.
