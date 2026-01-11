/**
 * Ninja Timer - Main Process
 * Electron main process with IPC message broker
 */

const { app, BrowserWindow, Menu, ipcMain, screen, dialog, nativeImage } = require('electron');
const path = require('path');

// Enable hot reload in development (soft reload for src/ files only)
try {
  require('electron-reload')(path.join(__dirname, 'src'), {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100
    }
  });
} catch (err) {
  // electron-reload not available in production
}

let mainWindow = null;
let outputWindow = null;

// Store last config to send to new output windows
let lastTimerConfig = null;

// Window settings
let outputAlwaysOnTop = true;  // Default: output stays on top
let controlAlwaysOnTop = false; // Default: control window normal

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 700,
    minWidth: 280,
    minHeight: 400,
    center: true,
    title: 'Ninja Timer',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('src/control/index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (outputWindow) {
      outputWindow.close();
    }
  });
}

function createOutputWindow() {
  if (outputWindow) {
    outputWindow.focus();
    return;
  }

  // Get display for positioning
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  // If multiple displays, prefer secondary for output
  const hasSecondaryDisplay = displays.length > 1;
  const targetDisplay = hasSecondaryDisplay
    ? displays.find(d => d.id !== primaryDisplay.id) || primaryDisplay
    : primaryDisplay;

  outputWindow = new BrowserWindow({
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    title: 'Ninja Timer - Output',
    fullscreen: hasSecondaryDisplay, // Auto-fullscreen on secondary display
    alwaysOnTop: outputAlwaysOnTop,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  outputWindow.loadFile('src/viewer/viewer.html');

  // Note: We no longer use did-finish-load to signal readiness.
  // The viewer will signal when it's fully initialized via 'viewer:ready'

  outputWindow.on('closed', () => {
    outputWindow = null;
    // Notify control window that output is closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:output-closed');
    }
  });
}

// ============ IPC Handlers ============

// ---- Canonical Timer State (StageTimer-style sync) ----

// Timer state broadcast: control -> main -> output
ipcMain.on('timer:state', (_event, state) => {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.webContents.send('timer:state', state);
  }
});

// Timer state request: output -> main -> control
ipcMain.on('timer:request-state', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('timer:request-state');
  }
});

// Blackout set (ABSOLUTE state, not toggle): control -> main -> output
ipcMain.on('blackout:set', (_event, isBlacked) => {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.webContents.send('blackout:state', isBlacked);
  }
});

// ---- Timer Commands (legacy, for sounds/flash) ----

// Timer commands: control -> main -> output
ipcMain.on('timer:command', (_event, data) => {
  const { command, config } = data;

  // Store config for new windows
  if (config) {
    lastTimerConfig = config;
  }

  // Forward to output window
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.webContents.send('timer:update', { command, config });
  }
});

// Display state sync: control -> output (runs every frame for live mirror)
ipcMain.on('display:state', (_event, state) => {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.webContents.send('display:update', state);
  }
});

// Viewer signals it's fully initialized and ready to receive state
ipcMain.on('viewer:ready', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('window:output-ready');
  }
});

// Window management
ipcMain.on('window:open-output', () => {
  createOutputWindow();
});

ipcMain.on('window:fullscreen-output', () => {
  if (outputWindow && !outputWindow.isDestroyed()) {
    // Always bring window to front first
    outputWindow.show();
    outputWindow.focus();
    // Then toggle fullscreen
    outputWindow.setFullScreen(!outputWindow.isFullScreen());
  }
});

// Keyboard shortcuts from output -> control
ipcMain.on('keyboard:shortcut', (_event, shortcut) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('keyboard:shortcut', shortcut);
  }
});

// Blackout toggle: control -> main -> output (and back to control for state sync)
ipcMain.on('blackout:toggle', () => {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.webContents.send('blackout:toggle');
  }
  // Also notify control window for UI sync
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('blackout:toggle');
  }
});

// Sound playback (placeholder for Phase 5)
ipcMain.on('sound:play', (_event, soundType) => {
  // Will implement in Phase 5
  console.log('Sound requested:', soundType);
});

// App version
ipcMain.handle('app:version', () => {
  return app.getVersion();
});

// Check for updates from GitHub
ipcMain.handle('app:check-updates', async () => {
  const https = require('https');
  const currentVersion = app.getVersion();

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/madebyjamstudios/ninja-timer/releases/latest',
      headers: { 'User-Agent': 'Ninja-Timer-App' }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          if (release.tag_name) {
            const latestVersion = release.tag_name.replace('v', '');
            resolve({
              currentVersion,
              latestVersion,
              updateAvailable: latestVersion !== currentVersion && latestVersion > currentVersion,
              downloadUrl: release.html_url
            });
          } else {
            resolve({ currentVersion, latestVersion: currentVersion, updateAvailable: false });
          }
        } catch (e) {
          resolve({ error: 'Failed to parse response' });
        }
      });
    }).on('error', () => {
      resolve({ error: 'Failed to connect to GitHub' });
    });
  });
});

// Stay on top settings
ipcMain.on('window:set-always-on-top', (_event, { window, value }) => {
  if (window === 'output') {
    outputAlwaysOnTop = value;
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.setAlwaysOnTop(value);
    }
  } else if (window === 'control') {
    controlAlwaysOnTop = value;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(value);
    }
  }
});

ipcMain.handle('window:get-always-on-top', () => {
  return {
    output: outputAlwaysOnTop,
    control: controlAlwaysOnTop
  };
});

// Confirm dialog with app icon
ipcMain.handle('dialog:confirm', async (_event, options) => {
  const iconPath = path.join(__dirname, 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'none',  // Removes yellow warning triangle, shows only app icon
    buttons: ['Cancel', 'Delete'],
    defaultId: 0,
    cancelId: 0,
    destructiveId: 1, // Makes Delete button red on macOS
    title: options.title || 'Confirm',
    message: options.message || 'Are you sure?',
    icon: icon
  });
  return result.response === 1; // true if Delete was clicked
});

// ============ Application Menu ============

const menuTemplate = [
  {
    label: 'Ninja Timer',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'File',
    submenu: [
      {
        label: 'New Output Window',
        accelerator: 'CmdOrCtrl+N',
        click: createOutputWindow
      },
      { type: 'separator' },
      { role: 'close' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  {
    label: 'Timer',
    submenu: [
      {
        label: 'Start',
        accelerator: 'CmdOrCtrl+Return',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('keyboard:shortcut', 'start');
          }
        }
      },
      {
        label: 'Pause',
        accelerator: 'CmdOrCtrl+.',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('keyboard:shortcut', 'pause');
          }
        }
      },
      {
        label: 'Reset',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('keyboard:shortcut', 'reset');
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Toggle Output Fullscreen',
        accelerator: 'CmdOrCtrl+F',
        click: () => {
          if (outputWindow && !outputWindow.isDestroyed()) {
            outputWindow.setFullScreen(!outputWindow.isFullScreen());
          }
        }
      }
    ]
  },
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      {
        label: 'Show Control Window',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Show Output Window',
        click: () => {
          if (outputWindow) {
            outputWindow.show();
            outputWindow.focus();
          } else {
            createOutputWindow();
          }
        }
      },
      { type: 'separator' },
      { role: 'front' }
    ]
  }
];

// ============ App Lifecycle ============

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle any uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
