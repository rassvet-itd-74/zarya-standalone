import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
} from 'viem';
import type { Abi, AbiEvent, Log, Account, HttpTransport, Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { WebContents } from 'electron';
import zaryaAbi from './assets/json/zaryaAbi.json';
import type { Config } from './configManager';

// ---------------------------------------------------------------------------
// Module-level state — all private key material stays in this process
// ---------------------------------------------------------------------------

let publicClient: ReturnType<typeof createPublicClient> | null = null;
let walletClient: ReturnType<
  typeof createWalletClient<HttpTransport, Chain, Account>
> | null = null;
let currentConfig: Config | null = null;

// Map of eventName → viem unwatch callback
const unwatchers = new Map<string, () => void>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildChain(chainId: number) {
  return defineChain({
    id: chainId,
    name: 'Zarya Current Network',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [__RPC_URL__] } },
  });
}

function getPublic() {
  if (!publicClient) throw new Error('Not connected — save network settings first');
  return publicClient;
}

function getWallet() {
  if (!walletClient) throw new Error('Wallet locked — unlock your key first');
  return walletClient;
}

function findEvent(eventName: string): AbiEvent {
  const event = (zaryaAbi as Abi).find(
    (item): item is AbiEvent =>
      item.type === 'event' && 'name' in item && item.name === eventName,
  );
  if (!event) throw new Error(`Unknown event in ABI: ${eventName}`);
  return event;
}

// ---------------------------------------------------------------------------
// Initialisation (called from main.ts)
// ---------------------------------------------------------------------------

/**
 * Creates (or re-creates) the public client from a saved config.
 * Also resets the wallet client — user will need to unlock again after
 * a config change.
 */
export function initPublicClient(config: Config): void {
  currentConfig = config;
  unwatchAll(); // tear down stale subscriptions
  walletClient = null;
  publicClient = createPublicClient({
    chain: buildChain(config.chainId),
    transport: http(__RPC_URL__),
  });
}

/**
 * Creates the wallet client from a decrypted private key.
 * Called immediately after a successful key:create or key:unlock — the
 * private key never leaves the main process.
 */
export function setWalletAccount(privateKey: `0x${string}`): void {
  if (!currentConfig) return; // config not yet saved — wallet will be init'd on next unlock
  walletClient = createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: buildChain(currentConfig.chainId),
    transport: http(__RPC_URL__),
  });
}

// ---------------------------------------------------------------------------
// Contract interaction
// ---------------------------------------------------------------------------

export async function contractRead(
  fn: string,
  args: readonly unknown[],
): Promise<unknown> {
  return getPublic().readContract({
    address: currentConfig!.contractAddress as `0x${string}`,
    abi: zaryaAbi as Abi,
    functionName: fn,
    args,
  });
}

export async function contractWrite(
  fn: string,
  args: readonly unknown[],
): Promise<`0x${string}`> {
  const wallet = getWallet();
  return wallet.writeContract({
    address: currentConfig!.contractAddress as `0x${string}`,
    abi: zaryaAbi as Abi,
    functionName: fn,
    args,
    chain: null,
    account: wallet.account!,
  });
}

export async function contractWaitTx(hash: `0x${string}`) {
  return getPublic().waitForTransactionReceipt({ hash });
}

export async function contractGetLogs(
  eventName: string,
  fromBlock: bigint = 0n,
): Promise<Log[]> {
  return getPublic().getLogs({
    address: currentConfig!.contractAddress as `0x${string}`,
    event: findEvent(eventName),
    fromBlock,
  });
}

// ---------------------------------------------------------------------------
// Event subscriptions (push events to the renderer via sender.send)
// ---------------------------------------------------------------------------

/**
 * Starts watching a contract event and pushes decoded logs to the renderer
 * window via `zarya:event` IPC messages.
 * Calling watch for an already-watched event is a no-op.
 */
export function contractWatch(eventName: string, sender: WebContents): void {
  if (unwatchers.has(eventName)) return;

  const unwatch = getPublic().watchContractEvent({
    address: currentConfig!.contractAddress as `0x${string}`,
    abi: zaryaAbi as Abi,
    eventName: eventName as never, // viem wants a literal union — we validate via findEvent above
    onLogs: (logs) => {
      if (!sender.isDestroyed()) {
        sender.send('zarya:event', eventName, logs);
      }
    },
  });

  unwatchers.set(eventName, unwatch);
}

/** Stops watching a specific event. */
export function contractUnwatch(eventName: string): void {
  const fn = unwatchers.get(eventName);
  if (fn) {
    fn();
    unwatchers.delete(eventName);
  }
}

/** Stops all active event watchers. Called on app quit. */
export function unwatchAll(): void {
  for (const fn of unwatchers.values()) fn();
  unwatchers.clear();
}

// ---------------------------------------------------------------------------
// Chain-level helpers
// ---------------------------------------------------------------------------

export async function getChainInfo(): Promise<{ blockNumber: string; chainId: number }> {
  const client = getPublic();
  const [blockNumber, chainId] = await Promise.all([
    client.getBlockNumber(),
    client.getChainId(),
  ]);
  return { blockNumber: blockNumber.toString(), chainId };
}

export async function getAddressBalance(address: string): Promise<string> {
  const wei = await getPublic().getBalance({ address: address as `0x${string}` });
  // Format to ETH with up to 6 decimal places, trim trailing zeros
  const eth = Number(wei) / 1e18;
  return eth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 });
}

/**
 * Checks whether the given address is a member of the organ identified by its
 * bytes32 organ code. Read-only — no gas required.
 */
export async function checkOrganMembership(
  organCode: string,
  address: string,
): Promise<boolean> {
  return getPublic()
    .readContract({
      address: currentConfig!.contractAddress as `0x${string}`,
      abi: zaryaAbi as Abi,
      functionName: 'isMember',
      args: [organCode as `0x${string}`, address as `0x${string}`],
    })
    .then(v => Boolean(v))
    .catch(() => false);
}
