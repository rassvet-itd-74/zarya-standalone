/** Shared mutable state — updated after key unlock. */
export let currentAddress = '';

export function setCurrentAddress(addr: string): void {
  currentAddress = addr;
}
