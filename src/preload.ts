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
