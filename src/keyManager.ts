import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// scrypt params: N=2^14 (~16 MB RAM per attempt), r=8, p=1
// N=2^15 hits Electron's OpenSSL 32 MB memory ceiling exactly and fails
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function keystorePath(): string {
  return path.join(app.getPath('userData'), 'keystore.json');
}

interface Keystore {
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
}

export function hasKey(): boolean {
  return fs.existsSync(keystorePath());
}

/**
 * Generates a new private key, encrypts it with the given password,
 * persists it to disk, and returns the corresponding address.
 * Throws if a key already exists.
 */
export function createKey(password: string): string {
  return createKeyRaw(password).address;
}

/**
 * Generates a new private key, encrypts it, persists it, and returns both
 * the address and the raw private key.
 * MAIN-PROCESS ONLY — never send privateKey over IPC.
 */
export function createKeyRaw(
  password: string,
): { address: string; privateKey: `0x${string}` } {
  if (hasKey()) throw new Error('Key already exists');

  const privateKey = generatePrivateKey();
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const derivedKey = deriveKey(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  // strip 0x prefix before encrypting raw bytes
  const plaintext = Buffer.from(privateKey.slice(2), 'hex');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const keystore: Keystore = {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };

  fs.writeFileSync(keystorePath(), JSON.stringify(keystore), { mode: 0o600 });

  return { address: privateKeyToAccount(privateKey).address, privateKey };
}

/**
 * Decrypts the persisted private key with the given password and returns
 * the raw private key hex string. Throws on wrong password or missing keystore.
 * PRIVATE — never call this from IPC handlers; only use it in this module.
 */
function decryptKey(password: string): `0x${string}` {
  if (!hasKey()) throw new Error('No keystore found');

  const keystore: Keystore = JSON.parse(
    fs.readFileSync(keystorePath(), 'utf-8'),
  );

  const salt = Buffer.from(keystore.salt, 'hex');
  const iv = Buffer.from(keystore.iv, 'hex');
  const tag = Buffer.from(keystore.tag, 'hex');
  const ciphertext = Buffer.from(keystore.ciphertext, 'hex');
  const derivedKey = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(tag);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Invalid password');
  }

  return `0x${plaintext.toString('hex')}` as `0x${string}`;
}

/**
 * Decrypts the persisted private key with the given password and returns
 * the corresponding address. Throws on wrong password or missing keystore.
 */
export function loadKey(password: string): string {
  return privateKeyToAccount(decryptKey(password)).address;
}

/**
 * Decrypts the persisted private key and returns both the address and the
 * raw private key. MAIN-PROCESS ONLY — never send privateKey over IPC.
 */
export function loadKeyRaw(
  password: string,
): { address: string; privateKey: `0x${string}` } {
  const privateKey = decryptKey(password);
  return { address: privateKeyToAccount(privateKey).address, privateKey };
}

/**
 * Opens a save dialog and writes the raw keystore JSON to the chosen file.
 * Returns true on success, false if the user cancelled.
 */
export async function exportKey(): Promise<boolean> {
  if (!hasKey()) throw new Error('No keystore found');

  const { canceled, filePath: dest } = await dialog.showSaveDialog({
    title: 'Export keystore',
    defaultPath: 'zarya-keystore.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !dest) return false;

  fs.copyFileSync(keystorePath(), dest);
  return true;
}

/**
 * Opens an open dialog and replaces the current keystore with the chosen file.
 * Returns true on success, false if the user cancelled.
 * Throws if the chosen file is not a valid keystore structure.
 */
export async function importKey(): Promise<boolean> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import keystore',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return false;

  const raw = fs.readFileSync(filePaths[0], 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (
    typeof parsed.salt !== 'string' ||
    typeof parsed.iv !== 'string' ||
    typeof parsed.tag !== 'string' ||
    typeof parsed.ciphertext !== 'string'
  ) {
    throw new Error('Invalid keystore file');
  }

  fs.writeFileSync(keystorePath(), raw, { mode: 0o600 });
  return true;
}
