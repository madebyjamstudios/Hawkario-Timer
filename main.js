/**
 * Hawkario - Main Process
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

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 700,
    minWidth: 280,
    minHeight: 400,
    center: true,
    title: 'Hawkario',
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
    title: 'Hawkario - Output',
    fullscreen: hasSecondaryDisplay, // Auto-fullscreen on secondary display
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  outputWindow.loadFile('src/viewer/viewer.html');

  outputWindow.webContents.on('did-finish-load', () => {
    // Notify control window that output is ready
    if (mainWindow) {
      mainWindow.webContents.send('window:output-ready');
    }

    // Send last config if we have one
    if (lastTimerConfig) {
      outputWindow.webContents.send('timer:update', {
        command: 'reset',
        config: lastTimerConfig
      });
    }
  });

  outputWindow.on('closed', () => {
    outputWindow = null;
  });
}

// ============ IPC Handlers ============

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

// Window management
ipcMain.on('window:open-output', () => {
  createOutputWindow();
});

ipcMain.on('window:fullscreen-output', () => {
  if (outputWindow && !outputWindow.isDestroyed()) {
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

// Confirm dialog with app icon
ipcMain.handle('dialog:confirm', async (_event, options) => {
  const iconPath = path.join(__dirname, 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    destructiveId: 0, // Makes Delete button red on macOS
    title: options.title || 'Confirm',
    message: options.message || 'Are you sure?',
    icon: icon
  });
  return result.response === 0; // true if Delete was clicked
});

// ============ Application Menu ============

const menuTemplate = [
  {
    label: 'Hawkario',
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
