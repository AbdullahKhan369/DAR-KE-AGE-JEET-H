const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const DATA_FILE = 'notes-data.json';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: '#f4f5f9',
    title: 'Smart Sticky Pro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

async function getDataFilePath() {
  return path.join(app.getPath('userData'), DATA_FILE);
}

function getDefaultData() {
  return {
    notes: [],
    googleSync: {
      enabled: false,
      status: 'local-only',
      profile: null,
      provider: 'local'
    },
    settings: {
      panelTheme: 'light',
      launchOnStartup: false
    },
    metadata: {
      schemaVersion: 2,
      updatedAt: new Date().toISOString()
    }
  };
}

async function readNotesData() {
  try {
    const raw = await fs.readFile(await getDataFilePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...getDefaultData(),
      ...parsed,
      settings: {
        ...getDefaultData().settings,
        ...(parsed.settings || {})
      },
      googleSync: {
        ...getDefaultData().googleSync,
        ...(parsed.googleSync || {})
      }
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return getDefaultData();
    }
    return {
      ...getDefaultData(),
      metadata: {
        schemaVersion: 2,
        updatedAt: new Date().toISOString(),
        warning: 'Stored file unreadable. Reset to defaults.'
      }
    };
  }
}

async function writeNotesData(payload) {
  const data = {
    ...getDefaultData(),
    ...payload,
    metadata: {
      ...(payload.metadata || {}),
      schemaVersion: 2,
      updatedAt: new Date().toISOString()
    }
  };
  await fs.writeFile(await getDataFilePath(), JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

ipcMain.handle('notes:load', async () => readNotesData());
ipcMain.handle('notes:save', async (_event, payload) => writeNotesData(payload));

ipcMain.handle('window:setAlwaysOnTop', (event, enabled) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setAlwaysOnTop(Boolean(enabled), 'screen-saver');
  }
  return { success: true };
});

ipcMain.handle('system:getOpenAtLogin', () => {
  const current = app.getLoginItemSettings();
  return { enabled: Boolean(current.openAtLogin) };
});

ipcMain.handle('system:setOpenAtLogin', (_event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath
  });
  return { success: true, enabled: Boolean(enabled) };
});

ipcMain.handle('google:login', async () => {
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Google Sync',
    message: 'Google sync can be enabled with Firebase/Drive credentials.',
    detail:
      'This build includes production-ready sync points. Add your credentials in renderer sync settings and implement OAuth token flow for full multi-device sync.',
    buttons: ['Continue (Demo Login)', 'Cancel'],
    defaultId: 0,
    cancelId: 1
  });

  if (choice.response === 1) {
    return { success: false };
  }

  return {
    success: true,
    profile: {
      name: 'Demo User',
      email: 'demo.user@gmail.com'
    }
  };
});

ipcMain.handle('google:logout', async () => ({ success: true }));

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
