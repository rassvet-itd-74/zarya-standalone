import type { ChainInfo } from '../types/chain';

export function readContract<T>(fn: string, args: unknown[]): Promise<T> {
  return window.zaryaAPI.read(fn, args) as Promise<T>;
}

export function writeContract(fn: string, args: unknown[]): Promise<`0x${string}`> {
  return window.zaryaAPI.write(fn, args);
}

export function waitTx(hash: `0x${string}`): Promise<void> {
  return window.zaryaAPI.waitTx(hash) as Promise<void>;
}

export function getLogs(eventName: string, fromBlock?: bigint): Promise<unknown[]> {
  return window.zaryaAPI.getLogs(eventName, fromBlock);
}

export function watchEvent(eventName: string): Promise<void> {
  return window.zaryaAPI.watch(eventName);
}

export function unwatchEvent(eventName: string): Promise<void> {
  return window.zaryaAPI.unwatch(eventName);
}

export function getChain(): Promise<ChainInfo> {
  return window.zaryaAPI.chain() as Promise<ChainInfo>;
}

export function getBalance(address: string): Promise<string> {
  return window.zaryaAPI.balance(address);
}

export function checkOrganMembership(organCode: string, address: string): Promise<boolean> {
  return window.zaryaAPI.checkOrgan(organCode, address);
}

export function onEvent(cb: (eventName: string, logs: unknown[]) => void): () => void {
  return window.zaryaAPI.onEvent(cb);
}
