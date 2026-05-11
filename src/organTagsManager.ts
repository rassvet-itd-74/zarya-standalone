import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
import { keccak256, toBytes } from 'viem';

export interface OrganTag {
  /** human-readable code entered by the user, e.g. "74.СОВ" */
  code: string;
  /** bytes32 organ identifier — resolved once on add and cached here */
  organ?: string;
}

function tagsPath(): string {
  return path.join(app.getPath('userData'), 'organ-tags.json');
}

export function readTags(): OrganTag[] {
  try {
    if (!fs.existsSync(tagsPath())) return [];
    return JSON.parse(fs.readFileSync(tagsPath(), 'utf-8')) as OrganTag[];
  } catch {
    return [];
  }
}

export function writeTags(tags: OrganTag[]): void {
  fs.writeFileSync(tagsPath(), JSON.stringify(tags, null, 2), { mode: 0o600 });
}

export async function exportTags(): Promise<boolean> {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Organ Tags',
    defaultPath: 'organ-tags.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!filePath) return false;
  fs.writeFileSync(filePath, JSON.stringify(readTags(), null, 2));
  return true;
}

export async function importTags(): Promise<OrganTag[] | null> {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Import Organ Tags',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (!filePaths[0]) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));
    if (!Array.isArray(data)) return null;
    return data as OrganTag[];
  } catch {
    return null;
  }
}

/**
 * Resolves a human-readable organ code (e.g. "74.СОВ") to its bytes32
 * PartyOrgan value. This is a pure local computation — no RPC calls needed.
 *
 * The contract derives PartyOrgan as:
 *   keccak256(abi.encodePacked(identifier))
 * where identifier IS the code string itself (e.g. "74.СОВ").
 *
 * Supported formats:
 *   "СЗД" | "СОВ" | "ПРЛ"           — Congress / CentralSoviet / Chairperson
 *   "<region>.СОВ|КОН|ОБС"           — Regional organs
 *   "<region>.<number>.СОВ|ОБС"      — Local organs
 *
 * Returns null if the code does not match any known format.
 */
export function resolveOrganTag(code: string): string | null {
  const normalised = code.trim().toUpperCase();
  if (!normalised) return null;

  const parts = normalised.split('.');

  if (parts.length === 1) {
    if (!['СЗД', 'СОВ', 'ПРЛ'].includes(parts[0])) return null;
  } else if (parts.length === 2) {
    if (!/^\d+$/.test(parts[0])) return null;
    if (!['СОВ', 'КОН', 'ОБС'].includes(parts[1])) return null;
  } else if (parts.length === 3) {
    if (!/^\d+$/.test(parts[0])) return null;
    if (!/^\d+$/.test(parts[1])) return null;
    if (!['СОВ', 'ОБС'].includes(parts[2])) return null;
  } else {
    return null;
  }

  return keccak256(toBytes(normalised));
}
