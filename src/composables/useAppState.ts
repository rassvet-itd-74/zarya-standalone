import { ref } from 'vue';
import type { CreateVotingPrefill } from '../types/voting';
import type { CellDetailContext } from '../types/matrix';
import { readConfig } from '../services/configService';
import { hasKey } from '../services/electronService';

export type ViewName =
  | 'setup'
  | 'unlock'
  | 'wallet'
  | 'settings'
  | 'dashboard'
  | 'votings'
  | 'matrix'
  | 'create-voting';

const currentView         = ref<ViewName>('setup');
const currentAddress      = ref('');
const isOffline           = ref(false);
const createVotingPrefill = ref<CreateVotingPrefill | null>(null);
const cellDetailContext   = ref<CellDetailContext | null>(null);

function navigate(view: ViewName): void {
  currentView.value = view;
}

async function afterUnlock(address: string): Promise<void> {
  currentAddress.value = address;
  const config = await readConfig();
  if (!config) {
    navigate('settings');
    return;
  }
  navigate('dashboard');
}

async function init(): Promise<void> {
  const exists = await hasKey();
  navigate(exists ? 'unlock' : 'setup');
}

export function useAppState() {
  return {
    currentView,
    currentAddress,
    isOffline,
    createVotingPrefill,
    cellDetailContext,
    navigate,
    afterUnlock,
    init,
  };
}
