import { contextBridge, ipcRenderer } from 'electron';

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

contextBridge.exposeInMainWorld('electronAPI', {
  hasKey: (): Promise<boolean> => ipcRenderer.invoke('key:hasKey'),
  createKey: (password: string): Promise<string> =>
    ipcRenderer.invoke('key:create', password),
  unlockKey: (password: string): Promise<string> =>
    ipcRenderer.invoke('key:unlock', password),
  exportKey: (): Promise<boolean> => ipcRenderer.invoke('key:export'),
  importKey: (): Promise<boolean> => ipcRenderer.invoke('key:import'),
});

contextBridge.exposeInMainWorld('configAPI', {
  read: (): Promise<{ contractAddress: string; chainId: number } | null> =>
    ipcRenderer.invoke('config:read'),
  write: (config: { contractAddress: string; chainId: number }): Promise<void> =>
    ipcRenderer.invoke('config:write', config),
  test: (): Promise<number> =>
    ipcRenderer.invoke('config:test'),
});

contextBridge.exposeInMainWorld('zaryaAPI', {
  read: (fn: string, args: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('zarya:read', fn, args),

  write: (fn: string, args: unknown[]): Promise<`0x${string}`> =>
    ipcRenderer.invoke('zarya:write', fn, args),

  waitTx: (hash: `0x${string}`): Promise<unknown> =>
    ipcRenderer.invoke('zarya:waitTx', hash),

  getLogs: (eventName: string, fromBlock?: bigint): Promise<unknown[]> =>
    ipcRenderer.invoke('zarya:getLogs', eventName, fromBlock),

  watch: (eventName: string): Promise<void> =>
    ipcRenderer.invoke('zarya:watch', eventName),

  unwatch: (eventName: string): Promise<void> =>
    ipcRenderer.invoke('zarya:unwatch', eventName),

  /**
   * Subscribe to events pushed by the main process via watchContractEvent.
   * Returns an unsubscribe function.
   */
  onEvent: (
    cb: (eventName: string, logs: unknown[]) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      eventName: string,
      logs: unknown[],
    ) => cb(eventName, logs);
    ipcRenderer.on('zarya:event', handler);
    return () => ipcRenderer.removeListener('zarya:event', handler);
  },
});
