import type { AppConfig } from '../types/config';

export function readConfig(): Promise<AppConfig | null> {
  return window.configAPI.read() as Promise<AppConfig | null>;
}

export function writeConfig(config: AppConfig): Promise<void> {
  return window.configAPI.write(config);
}

export function testConnection(): Promise<number> {
  return window.configAPI.test();
}
