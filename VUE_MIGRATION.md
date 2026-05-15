# Vue 3 Migration Plan

## Overview

Migrate the renderer from vanilla TypeScript + direct DOM manipulation to Vue 3
with the Composition API. The Electron main process, preload bridge, and all
`.ts` files outside `src/renderer.ts` and `src/views/` remain untouched.

---

## Design Principles

### SOLID

| Principle | Application |
|---|---|
| **S** — Single Responsibility | One composable = one concern. One component = one view. One service = one IPC bridge. |
| **O** — Open/Closed | Composables expose stable function interfaces; internals are not exported. Components are extended via props/slots, never edited to add features. |
| **L** — Liskov Substitution | All TypeScript interfaces are honoured by implementations; no silent widening with `as`. |
| **I** — Interface Segregation | Props are narrow — no component receives a god-object. Sub-components of `CreateVotingView` each receive only the fields they render. |
| **D** — Dependency Inversion | Components never call `window.*` directly. They depend on typed service functions. Services depend on the `window.*` interface declared in `env.d.ts`, not on the concrete preload implementation. |

### BEM + SCSS

- Existing partials in `styles/` are kept as-is. BEM blocks already match view names (`dashboard`, `votings`, `matrix`, `create-voting`, etc.).
- Each SCSS partial owns exactly one BEM block and its elements/modifiers.
- Components do **not** use `<style scoped>` — all styles live in `styles/`. This keeps the style boundary at the SCSS partial, not scattered across SFCs.
- Tailwind utilities are permitted only in `App.vue` for structural layout (positioning the theme toggle, logo). View-level styling stays in BEM partials.
- New elements introduced during migration follow the existing BEM naming already established in the partials.

### Type Safety

- `tsconfig.json` gains `"strict": true` (catches the implicit-any gaps in the current config).
- No `as unknown`, no `as HTMLElement` — types are inferred from service return values.
- All shared data shapes live in `src/types/`. Composables and services import from there.
- The `Window` interface moves to `src/env.d.ts` so it is a true ambient declaration, not tied to `renderer.ts` load order.

### Occam's Razor

- No Pinia, no Vue Router — unnecessary at 9 views with linear navigation.
- No global event bus — cross-view data passed via the `useAppState` prefill ref.
- No wrapper components around native HTML elements (no `<BaseInput>`, `<BaseButton>`) unless two or more views share a genuinely complex, stateful piece of UI.
- Sub-components are only introduced when a single SFC would exceed ~200 lines of template+script, or when a piece of UI is reused in more than one view.

---

## Types (`src/types/`)

One file per resource domain. Imported by services, composables, and components.
No file in this folder contains logic — types only.

### `src/types/config.ts`
```ts
export interface AppConfig {
  contractAddress: `0x${string}`;
  chainId: number;
}
```

### `src/types/chain.ts`
```ts
export interface ChainInfo {
  blockNumber: string;
  chainId: number;
}
```

### `src/types/organ.ts`
```ts
export interface OrganTag {
  code: string;
  organ?: string;
}

export type MembershipStatus = 'pending' | 'member' | 'unknown' | 'unresolved';
```

### `src/types/voting.ts`
```ts
export type VotingType =
  | 'numericalValue' | 'categoricalValue' | 'category'
  | 'decimals' | 'membership' | 'membershipRevocation'
  | 'theme' | 'statement';

export type VotingTab = 'active' | 'past';

export interface VotingRow {
  id: string;
  author: string;
  startTime: number;
  endTime: number;
  typeKey: VotingType;
  finalized: boolean;
  finalizedSuccess?: boolean;
}

export interface CreateVotingPrefill {
  x: bigint;
  y: bigint;
  isCategorical: boolean;
}
```

### `src/types/matrix.ts`
```ts
export type MatrixMode = 'numerical' | 'categorical';

export interface NumericalAgg {
  mean: number;
  stdev: number;
  min: number;
  max: number;
  count: number;
}

export interface CategoricalAgg {
  mode: string;
  distribution: Array<{ key: string; count: number; pct: number }>;
  count: number;
}

export interface CellDetailContext {
  x: bigint;
  y: bigint;
  decimals: number;
  isCategorical: boolean;
}
```

---

## Services (`src/services/`)

Thin, typed wrappers over the IPC bridge (`window.*`). Components and composables
import from services — never from `window` directly (Dependency Inversion).
Each service file is a module of pure async functions, no state.

### `src/services/electronService.ts`
Wraps `window.electronAPI`:
```ts
hasKey(): Promise<boolean>
createKey(password: string): Promise<string>
unlockKey(password: string): Promise<string>
exportKey(): Promise<boolean>
importKey(): Promise<boolean>
```

### `src/services/configService.ts`
Wraps `window.configAPI`:
```ts
readConfig(): Promise<AppConfig | null>
writeConfig(config: AppConfig): Promise<void>
testConnection(): Promise<number>
```

### `src/services/zaryaService.ts`
Wraps `window.zaryaAPI`. All return types are concrete, not `unknown`:
```ts
readContract<T>(fn: string, args: unknown[]): Promise<T>
writeContract(fn: string, args: unknown[]): Promise<`0x${string}`>
waitTx(hash: `0x${string}`): Promise<void>
getLogs(eventName: string, fromBlock?: bigint): Promise<unknown[]>
watch(eventName: string): Promise<void>
unwatch(eventName: string): Promise<void>
getChain(): Promise<ChainInfo>
getBalance(address: string): Promise<string>
checkOrganMembership(organCode: string, address: string): Promise<boolean>
onEvent(cb: (eventName: string, logs: unknown[]) => void): () => void
```

### `src/services/tagsService.ts`
Wraps `window.tagsAPI`:
```ts
readTags(): Promise<OrganTag[]>
writeTags(tags: OrganTag[]): Promise<void>
exportTags(): Promise<boolean>
importTags(): Promise<OrganTag[] | null>
resolveTag(code: string): Promise<string | null>
```

---

## Phase 0 — Tooling

- [ ] `npm install vue`
- [ ] `npm install --save-dev @vitejs/plugin-vue`
- [ ] Add `vue()` to `vite.renderer.config.ts` alongside `tailwindcss()`
- [ ] Add `"strict": true` to `tsconfig.json` `compilerOptions`
- [ ] Create `src/env.d.ts` — `*.vue` shim + move `Window` interface from `renderer.ts`

---

## Phase 1 — Composables

Replace `src/shared.ts` with focused composables. Each composable has one responsibility (SRP) and exports a stable interface (OCP).

### `src/composables/useAppState.ts`

| Export | Type | Replaces |
|---|---|---|
| `currentView` | `Ref<string>` | `show(id)` utility |
| `currentAddress` | `Ref<string>` | exported `let currentAddress` |
| `isOffline` | `Ref<boolean>` | exported `let isOffline` + DOM side-effect in `setIsOffline()` |
| `createVotingPrefill` | `Ref<CreateVotingPrefill \| null>` | module-level prefill vars in `createVoting.ts` |
| `navigate(view: string)` | `function` | `show(id)` call sites |
| `afterUnlock(address: string)` | `async function` | `afterUnlock()` in `renderer.ts` |

Singleton pattern — the same ref instances are returned on every call to the composable, shared across all components via ES module scope.

### `src/composables/useI18n.ts`

| Export | Description |
|---|---|
| `t(key: string): string` | Reactive translation — re-evaluates when lang changes |
| `changeLang(lang: string): Promise<void>` | Delegates to `i18n.ts`, increments internal trigger ref |
| `currentLang(): string` | Returns active language code |

Wraps `src/i18n.ts` (unchanged). The trigger ref approach means no extra reactive primitives are needed in components — plain `{{ t('key') }}` in templates reacts automatically.

### `src/composables/useTheme.ts`

Isolated from app state (SRP). Owns:
- `isDark: Ref<boolean>` — initialised from `localStorage`
- `toggle()` — flips ref, writes `localStorage`, sets `data-theme` on `<html>`

---

## Phase 2 — App shell

### `index.html`

Strip all view HTML. Body becomes:
```html
<body>
  <div id="app"></div>
  <script type="module" src="/src/renderer.ts"></script>
</body>
```

### `src/App.vue`

Top-level component. Owns only structural chrome — not business logic:
- Theme toggle (delegates to `useTheme`)
- Lang toggle (delegates to `useI18n`)
- RPC offline banner (`v-show="isOffline"`)
- Logo `<img>`
- Footer
- `<component :is="viewMap[currentView]" />` — active view slot

`viewMap` is a local `Record<string, Component>` mapping view name strings to imported SFCs. This is the only place view components are imported.

### `src/renderer.ts`

```ts
import './styles/index.scss';
import { createApp } from 'vue';
import { initI18n } from './i18n';
import App from './App.vue';

initI18n().then(() => createApp(App).mount('#app'));
```

---

## Phase 3 — Views

One `.vue` SFC per view. Converted in order of complexity (simplest first) so
each step is verifiable before moving to the next. The corresponding old `.ts`
file is deleted once the Vue component is working.

### View table

| # | Component | Source | SCSS partial | Sub-components |
|---|---|---|---|---|
| 1 | `SetupView.vue` | `renderer.ts` setup section | `_setup.scss` | — |
| 2 | `UnlockView.vue` | `renderer.ts` unlock section | `_setup.scss` | — |
| 3 | `WalletView.vue` | `renderer.ts` wallet section | `_wallet.scss` | — |
| 4 | `SettingsView.vue` | `renderer.ts` settings section | `_settings.scss` | — |
| 5 | `DashboardView.vue` | `views/dashboard.ts` | `_dashboard.scss` | `OrganTagList.vue` |
| 6 | `VotingsView.vue` | `views/votings.ts` | `_votings.scss` | `CastVotePanel.vue` |
| 7 | `MatrixView.vue` | `views/matrix.ts` (upper half) | `_matrix.scss` | — |
| 8 | `CellDetailView.vue` | `views/matrix.ts` (lower half) | `_matrix.scss` | — |
| 9 | `CreateVotingView.vue` | `views/createVoting.ts` | `_create-voting.scss` | `VotingTypePicker.vue`, `OrganPicker.vue`, `VotingFieldsForm.vue` |

### Sub-component rationale (Occam's Razor applied)

**`OrganTagList.vue`** — extracted because it manages its own async fetch + membership
check loop, independently of the rest of the dashboard. Keeps `DashboardView` under 150 lines.

**`CastVotePanel.vue`** — extracted because it has its own visible/hidden state,
organ select population, and tx lifecycle, separate from the votings list. ISP: it
only receives `votingId` and `onDone` callback as props.

**`VotingTypePicker.vue`** — step 1 of create-voting. Receives no props; emits
`select(type: VotingType)`. Pure presentation of 8 buttons.

**`OrganPicker.vue`** — step 2. Props: `modelValue: string | null`. Emits
`update:modelValue`. Owns organ-type/region/number selects + resolve call. Encapsulates
`resolveOrgan()` logic (SRP).

**`VotingFieldsForm.vue`** — step 3. Props: `type: VotingType`, `prefill: CreateVotingPrefill | null`.
Emits `submit(payload: VotingPayload)`. Owns all contextual field visibility logic (`v-if`
per field) and the duration picker. Keeps the form logic isolated from navigation logic.

### Navigation

- Views call `navigate('view-name')` from `useAppState`
- Cross-view data passed via `createVotingPrefill` ref (matrix cell → create voting)
- `onMounted` in each view replaces the current `showXxx()` function body
- `onUnmounted` tears down any event subscriptions (`zaryaService.unwatch`)

### i18n reactivity

All `{{ t('key') }}` template expressions re-render automatically when `lang`
changes — the manual `applyXxxTranslations()` call chain is eliminated entirely.

### SCSS / BEM conventions per view

Each SFC uses the BEM block that already exists in its corresponding SCSS partial.
No styles are added to `<style>` blocks inside SFCs.

| Component | BEM block | SCSS partial |
|---|---|---|
| `App.vue` | `.app`, `.lang-toggle`, `.theme-toggle`, `.rpc-banner` | `_base.scss`, `_components.scss` |
| `SetupView.vue` | `.setup-form` | `_setup.scss` |
| `UnlockView.vue` | `.unlock-form` | `_setup.scss` |
| `WalletView.vue` | `.wallet` | `_wallet.scss` |
| `SettingsView.vue` | `.settings-form` | `_settings.scss` |
| `DashboardView.vue` | `.dashboard` | `_dashboard.scss` |
| `OrganTagList.vue` | `.dashboard__organs` (element of dashboard) | `_dashboard.scss` |
| `VotingsView.vue` | `.votings` | `_votings.scss` |
| `CastVotePanel.vue` | `.cast-vote-panel` | `_votings.scss` |
| `MatrixView.vue` | `.matrix` | `_matrix.scss` |
| `CellDetailView.vue` | `.cell-detail` | `_matrix.scss` |
| `CreateVotingView.vue` | `.create-voting` | `_create-voting.scss` |
| `VotingTypePicker.vue` | `.cv-type-list`, `.cv-type-btn` | `_create-voting.scss` |
| `OrganPicker.vue` | `.cv-organ-picker` | `_create-voting.scss` |
| `VotingFieldsForm.vue` | `.cv-step`, `.cv-field-row` | `_create-voting.scss` |

New elements or modifiers added during migration follow the existing BEM naming
already established in the partials. No new BEM blocks are introduced without a
corresponding addition to the relevant SCSS partial.

---

## Phase 4 — Cleanup

Files **deleted**:
- `src/shared.ts`
- `src/views/dashboard.ts`
- `src/views/votings.ts`
- `src/views/matrix.ts`
- `src/views/createVoting.ts`

`renderer.ts` is reduced to ~5 lines. `Window` interface moves to `env.d.ts`.

---

## Final file structure

```
src/
  env.d.ts                       ← new: *.vue shim + Window interface
  renderer.ts                    ← ~5 lines
  i18n.ts                        ← unchanged
  main.ts                        ← unchanged
  preload.ts                     ← unchanged
  zaryaClient.ts                 ← unchanged
  keyManager.ts                  ← unchanged
  organTagsManager.ts            ← unchanged
  App.vue                        ← new
  types/
    config.ts                    ← new
    chain.ts                     ← new
    organ.ts                     ← new
    voting.ts                    ← new
    matrix.ts                    ← new
  services/
    electronService.ts           ← new
    configService.ts             ← new
    zaryaService.ts              ← new
    tagsService.ts               ← new
  composables/
    useAppState.ts               ← new (replaces shared.ts)
    useI18n.ts                   ← new
    useTheme.ts                  ← new
  components/
    SetupView.vue                ← new
    UnlockView.vue               ← new
    WalletView.vue               ← new
    SettingsView.vue             ← new
    DashboardView.vue            ← new
    OrganTagList.vue             ← new
    VotingsView.vue              ← new
    CastVotePanel.vue            ← new
    MatrixView.vue               ← new
    CellDetailView.vue           ← new
    CreateVotingView.vue         ← new
    VotingTypePicker.vue         ← new
    OrganPicker.vue              ← new
    VotingFieldsForm.vue         ← new
  styles/                        ← unchanged
  assets/                        ← unchanged
```

---

## What disappears

| Eliminated | Replaced by |
|---|---|
| ~120 `document.getElementById(...)` casts | Template bindings / `ref` attributes |
| `show(id)` + all call sites | `navigate(view)` + `<component :is>` in `App.vue` |
| All `applyXxxTranslations()` functions | `{{ t('key') }}` directly in templates |
| `innerHTML` string building (organ tags, votings list, matrix table, history) | `v-for` loops with typed item shape |
| Imperative `addEventListener` wiring | `@click`, `@change`, `@keydown` in templates |
| Module-level `let` mutable state | `ref()` inside `<script setup lang="ts">` |
| `window.*` calls scattered across view files | Calls go through `src/services/` only |

---

## Dependencies

| Package | Role | Type |
|---|---|---|
| `vue` ^3.x | Framework runtime | dependency |
| `@vitejs/plugin-vue` ^5.x | Vite SFC transform | devDependency |

No additional runtime dependencies (no Pinia, no Vue Router — unnecessary at this scale).
