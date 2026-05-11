import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface Config {
  contractAddress: string;
  chainId: number;
}

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export function readConfig(): Config | null {
  const p = configPath();
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
    if (
      typeof raw === 'object' &&
      raw !== null &&
      typeof raw.contractAddress === 'string' &&
      typeof raw.chainId === 'number'
    ) {
      return raw as Config;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeConfig(config: Config): void {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), { mode: 0o600 });
}
