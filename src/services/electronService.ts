export function hasKey(): Promise<boolean> {
  return window.electronAPI.hasKey();
}

export function createKey(password: string): Promise<string> {
  return window.electronAPI.createKey(password);
}

export function unlockKey(password: string): Promise<string> {
  return window.electronAPI.unlockKey(password);
}

export function exportKey(): Promise<boolean> {
  return window.electronAPI.exportKey();
}

export function importKey(): Promise<boolean> {
  return window.electronAPI.importKey();
}
