import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { hasKey, createKeyRaw, loadKeyRaw, exportKey, importKey } from './keyManager';
import { readConfig, writeConfig, Config } from './configManager';
import { readTags, writeTags, exportTags, importTags, resolveOrganTag } from './organTagsManager';
import type { OrganTag } from './organTagsManager';
import { createPublicClient, http } from 'viem';
import {
  initPublicClient,
  setWalletAccount,
  contractRead,
  contractWrite,
  contractWaitTx,
  contractGetLogs,
  contractWatch,
  contractUnwatch,
  unwatchAll,
  getChainInfo,
  getAddressBalance,
  checkOrganMembership,
} from './zaryaClient';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, '../../src/assets/images/icons/favicon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
  // Bootstrap the public client if the operator has already saved config.
  const cfg = readConfig();
  if (cfg) initPublicClient(cfg);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  unwatchAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

ipcMain.handle('key:hasKey', () => hasKey());

ipcMain.handle('key:create', async (_event, password: string) => {
  const { address, privateKey } = createKeyRaw(password);
  const cfg = readConfig();
  if (cfg) setWalletAccount(privateKey);
  return address;
});

ipcMain.handle('key:unlock', async (_event, password: string) => {
  const { address, privateKey } = loadKeyRaw(password);
  const cfg = readConfig();
  if (cfg) setWalletAccount(privateKey);
  return address;
});

ipcMain.handle('key:export', () => exportKey());

ipcMain.handle('key:import', () => importKey());

ipcMain.handle('config:read', () => readConfig());

ipcMain.handle('config:write', (_event, config: Config) => {
  writeConfig(config);
  initPublicClient(config);
  // wallet client is reset by initPublicClient — user re-unlocks on next action
});

ipcMain.handle('config:test', async () => {
  if (!__RPC_URL__) throw new Error('RPC URL not configured');
  const client = createPublicClient({ transport: http(__RPC_URL__) });
  return await client.getChainId();
});

// --- Zarya contract IPC ---

ipcMain.handle('zarya:read', (_event, fn: string, args: unknown[]) =>
  contractRead(fn, args),
);

ipcMain.handle('zarya:write', (_event, fn: string, args: unknown[]) =>
  contractWrite(fn, args),
);

ipcMain.handle('zarya:waitTx', (_event, hash: `0x${string}`) =>
  contractWaitTx(hash),
);

ipcMain.handle(
  'zarya:getLogs',
  (_event, eventName: string, fromBlock?: number | bigint) =>
    contractGetLogs(eventName, fromBlock !== undefined ? BigInt(fromBlock) : 0n),
);

ipcMain.handle('zarya:watch', (event, eventName: string) =>
  contractWatch(eventName, event.sender),
);

ipcMain.handle('zarya:unwatch', (_event, eventName: string) =>
  contractUnwatch(eventName),
);

ipcMain.handle('zarya:chain', () => getChainInfo());
ipcMain.handle('zarya:balance', (_e, address: string) => getAddressBalance(address));

ipcMain.handle('zarya:checkOrgan', (_event, organ: string, address: string) =>
  checkOrganMembership(organ, address),
);

// --- Organ tags IPC ---

ipcMain.handle('tags:read', () => readTags());

ipcMain.handle('tags:write', (_event, tags: OrganTag[]) => writeTags(tags));

ipcMain.handle('tags:export', () => exportTags());

ipcMain.handle('tags:import', () => importTags());

ipcMain.handle('tags:resolve', (_event, code: string) => resolveOrganTag(code));
