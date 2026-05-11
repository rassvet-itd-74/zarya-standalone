/** Shared mutable state — updated after key unlock. */
export let currentAddress = '';

export function setCurrentAddress(addr: string): void {
  currentAddress = addr;
}

/** True when the last RPC call failed — set by dashboard on each load. */
export let isOffline = false;

export function setIsOffline(val: boolean): void {
  isOffline = val;
  document.documentElement.dataset.offline = val ? 'true' : 'false';
  const banner = document.getElementById('rpc-banner');
  if (banner) banner.style.display = val ? '' : 'none';
}
