/**
 * Ninja Timer - Main Process
 * Electron main process with IPC message broker
 */

const { app, BrowserWindow, Menu, ipcMain, screen, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { Server: OSCServer, Client: OSCClient } = require('node-osc');

// Enable hot reload in development (soft reload for src/ files only)
// Store watcher reference for cleanup
let electronReloadWatcher = null;
try {
  // Only enable in development (when running via npm start)
  if (process.env.NODE_ENV !== 'production' && !app.isPackaged) {
    electronReloadWatcher = require('electron-reload')(path.join(__dirname, 'src'), {
      electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });
  }
} catch (err) {
  // electron-reload not available in production
}

let mainWindow = null;
let outputWindow = null;
let settingsWindow = null;
let splashWindow = null;

// Store last config to send to new output windows
let lastTimerConfig = null;

// Window settings
let outputAlwaysOnTop = true;  // Default: output stays on top
let controlAlwaysOnTop = false; // Default: control window normal

// ============ OSC Integration ============

let oscServer = null;
let oscClient = null;
let oscSettings = {
  enabled: false,
  listenPort: 8000,
  feedbackEnabled: false,
  feedbackHost: '127.0.0.1',
  feedbackPort: 9000
};

// ============ Safe IPC Helpers (Production Safety) ============

/**
 * Safely send a message to a window, handling all edge cases
 * @param {BrowserWindow} window - Target window
 * @param {string} channel - IPC channel name
 * @param {*} data - Data to send
 * @returns {boolean} - True if sent successfully
 */
function safeSend(window, channel, data) {
  try {
    if (window && !window.isDestroyed() && window.webContents) {
      window.webContents.send(channel, data);
      return true;
    }
  } catch (err) {
    console.error(`[SafeSend] Failed to send "${channel}":`, err.message);
  }
  return false;
}

/**
 * Safely send to main window
 */
function safeToMain(channel, data) {
  return safeSend(mainWindow, channel, data);
}

/**
 * Safely send to output window
 */
function safeToOutput(channel, data) {
  return safeSend(outputWindow, channel, data);
}

// ============ OSC Server/Client Management ============

/**
 * Start OSC server to receive commands
 */
function startOSCServer() {
  stopOSCServer(); // Clean up any existing server

  try {
    oscServer = new OSCServer(oscSettings.listenPort, '0.0.0.0');

    oscServer.on('message', (msg) => {
      const [address, ...args] = msg;
      console.log(`[OSC] Received: ${address}`, args);
      // Forward to control window for handling
      safeToMain('osc:command', { address, args });
    });

    oscServer.on('error', (err) => {
      console.error('[OSC] Server error:', err);
    });

    console.log(`[OSC] Server listening on port ${oscSettings.listenPort}`);
  } catch (err) {
    console.error('[OSC] Failed to start server:', err);
  }
}

/**
 * Stop OSC server
 */
function stopOSCServer() {
  if (oscServer) {
    try {
      oscServer.close();
    } catch (err) {
      console.error('[OSC] Error closing server:', err);
    }
    oscServer = null;
    console.log('[OSC] Server stopped');
  }
}

/**
 * Start OSC client for sending feedback
 */
function startOSCClient() {
  stopOSCClient(); // Clean up any existing client

  try {
    oscClient = new OSCClient(oscSettings.feedbackHost, oscSettings.feedbackPort);
    console.log(`[OSC] Feedback client ready -> ${oscSettings.feedbackHost}:${oscSettings.feedbackPort}`);
  } catch (err) {
    console.error('[OSC] Failed to start client:', err);
  }
}

/**
 * Stop OSC client
 */
function stopOSCClient() {
  if (oscClient) {
    try {
      oscClient.close();
    } catch (err) {
      // Client may not have close method in all versions
    }
    oscClient = null;
  }
}

/**
 * Send OSC feedback message
 */
function sendOSCFeedback(address, ...args) {
  if (!oscClient || !oscSettings.feedbackEnabled) return;

  try {
    oscClient.send(address, ...args);
  } catch (err) {
    console.error('[OSC] Feedback send error:', err);
  }
}

/**
 * Apply OSC settings (start/stop server/client as needed)
 */
function applyOSCSettings() {
  if (oscSettings.enabled) {
    startOSCServer();
  } else {
    stopOSCServer();
  }

  if (oscSettings.feedbackEnabled) {
    startOSCClient();
  } else {
    stopOSCClient();
  }
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 300,
    height: 200,
    frame: false,
    transparent: true,
    center: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile('src/splash/splash.html');
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 700,
    minWidth: 280,
    minHeight: 400,
    maxWidth: 500,
    center: true,
    show: false,  // Hidden until app signals ready
    title: 'Ninja Timer',
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,  // Production Safety: Explicit sandbox mode
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('src/control/index.html');

  // Handle close with confirmation if timer is running
  mainWindow.on('close', async (event) => {
    // Skip confirmation if force quitting or timer not running
    if (isForceQuitting || !timerIsRunning) {
      return; // Allow close
    }

    // Prevent close until user confirms
    event.preventDefault();

    const iconPath = path.join(__dirname, 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'none',
      buttons: ['Cancel', 'Quit'],
      defaultId: 0,
      cancelId: 0,
      title: 'Timer Running',
      message: 'Timer is running. Quit anyway?',
      icon: icon
    });

    if (result.response === 1) {
      // User confirmed quit
      isForceQuitting = true;
      mainWindow.close();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    try {
      if (outputWindow && !outputWindow.isDestroyed()) {
        outputWindow.close();
      }
    } catch (err) {
      console.error('[MainWindow:closed] Error closing output:', err);
    }
  });
}

function createOutputWindow() {
  // Production Safety: Check if window exists AND is not destroyed
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.focus();
    return;
  }

  // Reset reference if window was destroyed
  outputWindow = null;

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
    backgroundColor: '#000000', // Required for live resize rendering on macOS
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,  // Production Safety: Explicit sandbox mode
      preload: path.join(__dirname, 'preload.js')
    }
  });

  outputWindow.loadFile('src/output/output.html');

  // Note: We no longer use did-finish-load to signal readiness.
  // The output window will signal when it's fully initialized via 'output:ready'

  outputWindow.on('closed', () => {
    outputWindow = null;
    // Notify control window that output is closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:output-closed');
    }
  });
}

// Settings window position persistence key
const SETTINGS_WINDOW_BOUNDS_KEY = 'ninja:settingsWindowBounds';

function createSettingsWindow(timerIndex) {
  // Production Safety: Check if window exists AND is not destroyed
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    // Update to show requested timer
    safeSend(settingsWindow, 'settings:load-timer', timerIndex);
    return;
  }

  // Reset reference if window was destroyed
  settingsWindow = null;

  // Try to restore saved window position
  let windowBounds = { width: 450, height: 700, x: undefined, y: undefined };
  try {
    const savedBounds = mainWindow?.webContents?.executeJavaScript(
      `localStorage.getItem('${SETTINGS_WINDOW_BOUNDS_KEY}')`
    );
    // Note: We can't use async here easily, so we'll use defaults and let the window save on close
  } catch (err) {
    // Use defaults
  }

  settingsWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    minWidth: 380,
    minHeight: 500,
    center: true,
    title: 'Timer Settings',
    parent: mainWindow,  // Associate with main (macOS)
    modal: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.loadFile('src/settings/settings.html');

  // Send the timer index once the window is ready
  settingsWindow.webContents.on('did-finish-load', () => {
    safeSend(settingsWindow, 'settings:init', timerIndex);
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    // Notify control window that settings is closed
    safeToMain('window:settings-closed');
  });

  // Save window position on move/resize
  settingsWindow.on('moved', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      const bounds = settingsWindow.getBounds();
      safeToMain('settings:window-bounds', bounds);
    }
  });

  settingsWindow.on('resized', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      const bounds = settingsWindow.getBounds();
      safeToMain('settings:window-bounds', bounds);
    }
  });
}

// ============ IPC Handlers (with Production Safety) ============

// ---- Canonical Timer State (StageTimer-style sync) ----

// Timer state broadcast: control -> main -> output
ipcMain.on('timer:state', (_event, state) => {
  try {
    safeToOutput('timer:state', state);
  } catch (err) {
    console.error('[IPC:timer:state] Error:', err);
  }
});

// Timer state request: output -> main -> control
ipcMain.on('timer:request-state', () => {
  try {
    safeToMain('timer:request-state');
  } catch (err) {
    console.error('[IPC:timer:request-state] Error:', err);
  }
});

// Blackout set (ABSOLUTE state, not toggle): control -> main -> output
ipcMain.on('blackout:set', (_event, isBlacked) => {
  try {
    safeToOutput('blackout:state', isBlacked);
  } catch (err) {
    console.error('[IPC:blackout:set] Error:', err);
  }
});

// ---- Timer Commands (legacy, for sounds/flash) ----

// Timer commands: control -> main -> output
ipcMain.on('timer:command', (_event, data) => {
  try {
    const { command, config } = data || {};

    // Store config for new windows
    if (config) {
      lastTimerConfig = config;
    }

    // Forward to output window
    safeToOutput('timer:update', { command, config });
  } catch (err) {
    console.error('[IPC:timer:command] Error:', err);
  }
});

// Display state sync: control -> output (runs every frame for live mirror)
ipcMain.on('display:state', (_event, state) => {
  try {
    safeToOutput('display:update', state);
  } catch (err) {
    console.error('[IPC:display:state] Error:', err);
  }
});

// Output window signals it's fully initialized and ready to receive state
ipcMain.on('output:ready', () => {
  try {
    safeToMain('window:output-ready');
  } catch (err) {
    console.error('[IPC:output:ready] Error:', err);
  }
});

// Window management
ipcMain.on('window:open-output', () => {
  try {
    createOutputWindow();
  } catch (err) {
    console.error('[IPC:window:open-output] Error:', err);
  }
});

ipcMain.on('window:fullscreen-output', () => {
  try {
    if (outputWindow && !outputWindow.isDestroyed()) {
      // Always bring window to front first
      outputWindow.show();
      outputWindow.focus();
      // Then toggle fullscreen
      outputWindow.setFullScreen(!outputWindow.isFullScreen());
    }
  } catch (err) {
    console.error('[IPC:window:fullscreen-output] Error:', err);
  }
});

// Focus output window (bring to top)
ipcMain.on('window:focus-output', () => {
  try {
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.show();
      outputWindow.focus();
    }
  } catch (err) {
    console.error('[IPC:window:focus-output] Error:', err);
  }
});

// ---- Settings Window Management ----

// Open settings window
ipcMain.on('window:open-settings', (_event, timerIndex) => {
  try {
    createSettingsWindow(timerIndex);
  } catch (err) {
    console.error('[IPC:window:open-settings] Error:', err);
  }
});

// Close settings window
ipcMain.on('window:close-settings', () => {
  try {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
  } catch (err) {
    console.error('[IPC:window:close-settings] Error:', err);
  }
});

// Settings window signals ready
ipcMain.on('settings:ready', () => {
  try {
    safeToMain('window:settings-ready');
  } catch (err) {
    console.error('[IPC:settings:ready] Error:', err);
  }
});

// Settings window requests timer data: settings -> main -> control
ipcMain.on('settings:request-timer', (_event, timerIndex) => {
  try {
    safeToMain('settings:request-timer', timerIndex);
  } catch (err) {
    console.error('[IPC:settings:request-timer] Error:', err);
  }
});

// Control sends timer data to settings: control -> main -> settings
ipcMain.on('settings:timer-data', (_event, data) => {
  try {
    safeSend(settingsWindow, 'settings:timer-data', data);
  } catch (err) {
    console.error('[IPC:settings:timer-data] Error:', err);
  }
});

// Settings saves timer: settings -> main -> control
ipcMain.on('settings:save-timer', (_event, data) => {
  try {
    safeToMain('settings:save-timer', data);
  } catch (err) {
    console.error('[IPC:settings:save-timer] Error:', err);
  }
});

// Control tells settings to load a different timer (when selection changes)
ipcMain.on('settings:load-timer', (_event, timerIndex) => {
  try {
    safeSend(settingsWindow, 'settings:load-timer', timerIndex);
  } catch (err) {
    console.error('[IPC:settings:load-timer] Error:', err);
  }
});

// Keyboard shortcuts from output -> control
ipcMain.on('keyboard:shortcut', (_event, shortcut) => {
  try {
    safeToMain('keyboard:shortcut', shortcut);
  } catch (err) {
    console.error('[IPC:keyboard:shortcut] Error:', err);
  }
});

// Blackout toggle: control -> main -> output (and back to control for state sync)
ipcMain.on('blackout:toggle', () => {
  try {
    safeToOutput('blackout:toggle');
    safeToMain('blackout:toggle');
  } catch (err) {
    console.error('[IPC:blackout:toggle] Error:', err);
  }
});

// Sound playback (placeholder for Phase 5)
ipcMain.on('sound:play', (_event, soundType) => {
  // Will implement in Phase 5
  console.log('Sound requested:', soundType);
});

// ============ OSC IPC Handlers ============

// Get OSC settings
ipcMain.handle('osc:get-settings', () => {
  return { ...oscSettings };
});

// Update OSC settings
ipcMain.handle('osc:set-settings', (_event, newSettings) => {
  try {
    oscSettings = { ...oscSettings, ...newSettings };
    applyOSCSettings();
    console.log('[OSC] Settings updated:', oscSettings);
    return { success: true };
  } catch (err) {
    console.error('[OSC] Failed to update settings:', err);
    return { success: false, error: err.message };
  }
});

// Send OSC feedback message (called from renderer)
ipcMain.handle('osc:send-feedback', (_event, { address, args }) => {
  if (!oscClient || !oscSettings.feedbackEnabled) return;
  try {
    oscClient.send(address, ...args);
  } catch (err) {
    console.error('[OSC] Feedback send error:', err);
  }
});

// App version
ipcMain.handle('app:version', () => {
  return app.getVersion();
});

// Check for updates from GitHub (compares local vs remote commit SHA)
// Local SHA is read from version.json (embedded at build time) for packaged apps
ipcMain.handle('app:check-updates', async () => {
  const https = require('https');
  const fs = require('fs');
  const pathModule = require('path');

  // Try to read embedded version info first (for packaged apps)
  let localSha = null;
  const versionPath = pathModule.join(__dirname, 'version.json');

  try {
    if (fs.existsSync(versionPath)) {
      const versionInfo = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      localSha = versionInfo.commit;
    }
  } catch (e) {
    // Fall through to git method
  }

  // Fallback: try git directly (for development)
  // Production Safety: Use execFile instead of exec, with timeout
  if (!localSha || localSha === 'unknown') {
    const { execFile } = require('child_process');
    localSha = await new Promise((resolve) => {
      const child = execFile('git', ['rev-parse', 'HEAD'], {
        cwd: __dirname,
        timeout: 5000  // 5 second timeout
      }, (error, stdout) => {
        resolve(error ? null : stdout.trim());
      });
    });
  }

  if (!localSha) {
    return { error: 'Could not determine app version' };
  }

  // Check GitHub for latest commit AND latest release
  // Production Safety: Added timeouts, size limits, and proper stream cleanup
  const NETWORK_TIMEOUT = 10000;  // 10 seconds
  const MAX_RESPONSE_SIZE = 1024 * 100;  // 100KB limit

  return new Promise((resolve) => {
    // First, get latest commit on main
    const commitOptions = {
      hostname: 'api.github.com',
      path: '/repos/madebyjamstudios/ninja-timer/commits/main',
      headers: { 'User-Agent': 'Ninja-Timer-App' },
      timeout: NETWORK_TIMEOUT
    };

    const req = https.get(commitOptions, (res) => {
      let data = '';
      let totalSize = 0;

      res.on('data', chunk => {
        totalSize += chunk.length;
        if (totalSize > MAX_RESPONSE_SIZE) {
          res.destroy();
          resolve({ error: 'Response too large' });
          return;
        }
        data += chunk;
      });

      res.on('end', () => {
        try {
          const commit = JSON.parse(data);
          if (!commit.sha) {
            resolve({ error: 'Could not fetch latest commit' });
            return;
          }

          const remoteSha = commit.sha;
          const updateAvailable = localSha !== remoteSha;

          // Now check for latest release to get download URL
          const releaseOptions = {
            hostname: 'api.github.com',
            path: '/repos/madebyjamstudios/ninja-timer/releases/latest',
            headers: { 'User-Agent': 'Ninja-Timer-App' },
            timeout: NETWORK_TIMEOUT
          };

          const relReq = https.get(releaseOptions, (relRes) => {
            let relData = '';
            let relTotalSize = 0;

            relRes.on('data', chunk => {
              relTotalSize += chunk.length;
              if (relTotalSize > MAX_RESPONSE_SIZE) {
                relRes.destroy();
                // Still return partial result
                resolve({
                  updateAvailable,
                  localSha: localSha.substring(0, 7),
                  remoteSha: remoteSha.substring(0, 7),
                  downloadUrl: null,
                  repoUrl: 'https://github.com/madebyjamstudios/ninja-timer'
                });
                return;
              }
              relData += chunk;
            });

            relRes.on('end', () => {
              let downloadUrl = null;
              let releaseName = null;

              try {
                const release = JSON.parse(relData);
                // Find .dmg asset
                const dmgAsset = release.assets?.find(a => a.name.endsWith('.dmg'));
                downloadUrl = dmgAsset?.browser_download_url || null;
                releaseName = release.name || release.tag_name || null;
              } catch (e) {
                // No release found, that's okay
              }

              resolve({
                updateAvailable,
                localSha: localSha.substring(0, 7),
                remoteSha: remoteSha.substring(0, 7),
                downloadUrl,
                releaseName,
                repoUrl: 'https://github.com/madebyjamstudios/ninja-timer'
              });
            });

            relRes.on('error', () => {
              relRes.destroy();
            });
          });

          relReq.on('error', () => {
            // Release check failed, but commit check succeeded
            resolve({
              updateAvailable,
              localSha: localSha.substring(0, 7),
              remoteSha: remoteSha.substring(0, 7),
              downloadUrl: null,
              repoUrl: 'https://github.com/madebyjamstudios/ninja-timer'
            });
          });

          relReq.on('timeout', () => {
            relReq.destroy();
            resolve({
              updateAvailable,
              localSha: localSha.substring(0, 7),
              remoteSha: remoteSha.substring(0, 7),
              downloadUrl: null,
              repoUrl: 'https://github.com/madebyjamstudios/ninja-timer'
            });
          });
        } catch (e) {
          res.destroy();
          resolve({ error: 'Failed to parse response' });
        }
      });

      res.on('error', () => {
        res.destroy();
      });
    });

    req.on('error', () => {
      resolve({ error: 'Failed to connect to GitHub' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Connection timed out' });
    });
  });
});

// Download updates from GitHub Releases
// Production Safety: URL validation, redirect limits, proper stream cleanup
ipcMain.handle('app:download-updates', async (_event, downloadUrl) => {
  const https = require('https');
  const fs = require('fs');
  const pathModule = require('path');
  const { shell } = require('electron');

  // Security: Allowed download hosts
  const ALLOWED_HOSTS = [
    'github.com',
    'objects.githubusercontent.com',  // GitHub release assets
    'github-releases.githubusercontent.com'
  ];
  const MAX_REDIRECTS = 5;
  const DOWNLOAD_TIMEOUT = 60000;  // 60 seconds for large files

  if (!downloadUrl) {
    return { success: false, error: 'No download URL available. Please create a GitHub Release with the .dmg attached.' };
  }

  // Validate initial URL
  try {
    const initialUrl = new URL(downloadUrl);
    if (!ALLOWED_HOSTS.some(host => initialUrl.hostname.endsWith(host))) {
      return { success: false, error: 'Download URL must be from GitHub' };
    }
  } catch (e) {
    return { success: false, error: 'Invalid download URL' };
  }

  const downloadsPath = app.getPath('downloads');
  const fileName = 'Ninja-Timer-latest.dmg';
  const filePath = pathModule.join(downloadsPath, fileName);

  return new Promise((resolve) => {
    // Delete existing file if present
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      // Ignore deletion errors
    }

    let file = null;
    let redirectCount = 0;
    let resolved = false;

    const cleanup = () => {
      if (file) {
        try {
          file.close();
        } catch (e) {
          // Ignore
        }
      }
    };

    const fail = (error) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      try {
        fs.unlink(filePath, () => {});
      } catch (e) {
        // Ignore
      }
      resolve({ success: false, error });
    };

    const download = (url) => {
      // Check redirect limit
      if (redirectCount >= MAX_REDIRECTS) {
        fail('Too many redirects');
        return;
      }

      // Validate redirect URL
      let urlObj;
      try {
        urlObj = new URL(url);
        if (!ALLOWED_HOSTS.some(host => urlObj.hostname.endsWith(host))) {
          fail('Redirect to unauthorized host');
          return;
        }
      } catch (e) {
        fail('Invalid redirect URL');
        return;
      }

      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        headers: { 'User-Agent': 'Ninja-Timer-App' },
        timeout: DOWNLOAD_TIMEOUT
      };

      const req = https.get(options, (response) => {
        // Handle redirects (GitHub uses them for asset downloads)
        if (response.statusCode === 302 || response.statusCode === 301) {
          response.destroy();  // Clean up current response
          redirectCount++;
          download(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          response.destroy();
          fail(`Download failed with status ${response.statusCode}`);
          return;
        }

        // Create file stream only after successful response
        file = fs.createWriteStream(filePath);

        file.on('error', (err) => {
          response.destroy();
          fail(err.message);
        });

        file.on('finish', () => {
          if (resolved) return;
          resolved = true;
          file.close(() => {
            // Open the downloaded .dmg
            shell.openPath(filePath).then(() => {
              resolve({ success: true, filePath });
            }).catch((err) => {
              resolve({ success: true, filePath, openError: err.message });
            });
          });
        });

        response.pipe(file);

        response.on('error', (err) => {
          fail(err.message);
        });
      });

      req.on('error', (err) => {
        fail(err.message);
      });

      req.on('timeout', () => {
        req.destroy();
        fail('Download timed out');
      });
    };

    download(downloadUrl);
  });
});

// Restart the app
ipcMain.on('app:restart', () => {
  app.relaunch();
  app.exit(0);
});

// ============ Message Broadcasting (with Production Safety) ============

// Message send: control -> main -> output
ipcMain.on('message:send', (_event, message) => {
  try {
    safeToOutput('message:update', message);
  } catch (err) {
    console.error('[IPC:message:send] Error:', err);
  }
});

// Message state request: output -> main -> control
ipcMain.on('message:request-state', () => {
  try {
    safeToMain('message:request-state');
  } catch (err) {
    console.error('[IPC:message:request-state] Error:', err);
  }
});

// Stay on top settings
ipcMain.on('window:set-always-on-top', (_event, { window, value }) => {
  try {
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
  } catch (err) {
    console.error('[IPC:window:set-always-on-top] Error:', err);
  }
});

ipcMain.handle('window:get-always-on-top', () => {
  return {
    output: outputAlwaysOnTop,
    control: controlAlwaysOnTop
  };
});

// Set window background color (for theme switching)
ipcMain.on('window:set-background-color', (_event, { window, color }) => {
  try {
    if (window === 'control' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor(color);
    } else if (window === 'settings' && settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.setBackgroundColor(color);
    }
  } catch (err) {
    console.error('[IPC:window:set-background-color] Error:', err);
  }
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

// ============ Custom Sounds ============

const soundsDir = path.join(app.getPath('userData'), 'sounds');
const soundsMetaPath = path.join(soundsDir, 'sounds.json');

// Ensure sounds directory exists
function ensureSoundsDir() {
  if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
  }
}

// Load sounds metadata
function loadSoundsMeta() {
  ensureSoundsDir();
  if (!fs.existsSync(soundsMetaPath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(soundsMetaPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load sounds meta:', e);
    return [];
  }
}

// Save sounds metadata
function saveSoundsMeta(sounds) {
  ensureSoundsDir();
  fs.writeFileSync(soundsMetaPath, JSON.stringify(sounds, null, 2));
}

// List all custom sounds
ipcMain.handle('sounds:list', () => {
  return loadSoundsMeta();
});

// Upload a custom sound
ipcMain.handle('sounds:upload', async (_event, { fileName, fileData, soundName }) => {
  ensureSoundsDir();

  const sounds = loadSoundsMeta();

  // Generate unique ID
  const id = `sound-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Determine format from extension
  const ext = fileName.toLowerCase().split('.').pop();
  const format = ['mp3', 'wav', 'ogg', 'webm', 'm4a'].includes(ext) ? ext : 'mp3';

  // Create sound metadata
  const sound = {
    id,
    name: soundName || fileName.replace(/\.[^/.]+$/, ''),
    fileName: `${id}.${format}`,
    format,
    addedAt: Date.now()
  };

  // Save sound file
  const buffer = Buffer.from(fileData, 'base64');
  const soundPath = path.join(soundsDir, sound.fileName);
  fs.writeFileSync(soundPath, buffer);

  // Update metadata
  sounds.push(sound);
  saveSoundsMeta(sounds);

  return sound;
});

// Delete a custom sound
ipcMain.handle('sounds:delete', (_event, soundId) => {
  const sounds = loadSoundsMeta();
  const soundIndex = sounds.findIndex(s => s.id === soundId);

  if (soundIndex === -1) {
    return false;
  }

  const sound = sounds[soundIndex];
  const soundPath = path.join(soundsDir, sound.fileName);

  // Delete file
  if (fs.existsSync(soundPath)) {
    fs.unlinkSync(soundPath);
  }

  // Update metadata
  sounds.splice(soundIndex, 1);
  saveSoundsMeta(sounds);

  return true;
});

// Get sound file data (base64)
ipcMain.handle('sounds:get-data', (_event, soundId) => {
  const sounds = loadSoundsMeta();
  const sound = sounds.find(s => s.id === soundId);

  if (!sound) {
    return null;
  }

  const soundPath = path.join(soundsDir, sound.fileName);
  if (!fs.existsSync(soundPath)) {
    return null;
  }

  const fileData = fs.readFileSync(soundPath);
  return {
    ...sound,
    data: fileData.toString('base64')
  };
});

// Open file dialog to select sound
ipcMain.handle('sounds:select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Sound File',
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'webm', 'm4a'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);

  return {
    fileName,
    fileData: fileData.toString('base64')
  };
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

// Track if we're force quitting (bypass confirmation)
let isForceQuitting = false;

// Track timer running status (updated via IPC)
let timerIsRunning = false;

// IPC handler to update timer running status
ipcMain.on('timer:running-status', (_event, isRunning) => {
  timerIsRunning = isRunning;
});

// IPC handler for app ready signal from control window
ipcMain.on('app:ready', () => {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
  }
});

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Show splash screen first
  createSplashWindow();

  // Create main window (hidden until ready)
  createMainWindow();

  // Safety timeout: close splash and show main window after 5 seconds max
  // This prevents the app from being stuck on splash if something goes wrong
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      console.log('[App] Safety timeout: closing splash screen');
      splashWindow.close();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      console.log('[App] Safety timeout: showing main window');
      mainWindow.show();
    }
  }, 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Cleanup before app quits
app.on('before-quit', () => {
  console.log('[App] before-quit - cleaning up...');
  isForceQuitting = true;
  stopOSCServer();
  stopOSCClient();
});

// Final cleanup when app is about to quit
app.on('will-quit', (event) => {
  console.log('[App] will-quit - final cleanup');
  // Force exit to avoid fsevents cleanup race condition in development
  // This prevents the "abort() called" crash from electron-reload's chokidar/fsevents
  if (!app.isPackaged) {
    event.preventDefault();
    process.exit(0);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============ Global Error Handlers (Production Safety) ============

/**
 * Log an error with context and continue operation
 * In production, this prevents crashes from taking down the entire app
 */
function handleCriticalError(context, error) {
  console.error(`[CRITICAL:${context}]`, error);
  // Future: Could send to error reporting service
  // Future: Could show user notification for severe errors
}

// Handle uncaught exceptions in main process
process.on('uncaughtException', (error) => {
  handleCriticalError('uncaughtException', error);
  // Don't exit - try to keep app running
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  handleCriticalError('unhandledRejection', { reason, promise });
});

// Handle renderer process crashes
app.on('render-process-gone', (event, webContents, details) => {
  handleCriticalError('render-process-gone', {
    reason: details.reason,
    exitCode: details.exitCode
  });

  // Attempt to recover by recreating the window
  if (mainWindow && mainWindow.webContents === webContents) {
    console.log('[Recovery] Main window crashed, attempting restart...');
    mainWindow = null;
    try {
      createMainWindow();
    } catch (err) {
      handleCriticalError('mainWindow-recovery-failed', err);
    }
  } else if (outputWindow && outputWindow.webContents === webContents) {
    console.log('[Recovery] Output window crashed, closing...');
    outputWindow = null;
    // Notify control window
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('window:output-closed');
      } catch (err) {
        // Ignore if main window is also having issues
      }
    }
  }
});

// Handle child process crashes
app.on('child-process-gone', (event, details) => {
  handleCriticalError('child-process-gone', {
    type: details.type,
    reason: details.reason,
    exitCode: details.exitCode
  });
});
