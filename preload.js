/**
 * Ninja Timer - Preload Script
 * Secure IPC bridge between renderer processes and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API to renderer processes
contextBridge.exposeInMainWorld('ninja', {
  // ============ Canonical Timer State (StageTimer-style sync) ============

  // Broadcast canonical timer state to output (control -> main -> output)
  sendTimerState: (state) => {
    ipcRenderer.send('timer:state', state);
  },

  // Listen for canonical timer state updates (output window receives)
  onTimerState: (callback) => {
    ipcRenderer.on('timer:state', (_event, state) => callback(state));
  },

  // Request full timer state (output -> control, on load/reload)
  requestTimerState: () => {
    ipcRenderer.send('timer:request-state');
  },

  // Listen for state requests (control responds with full state)
  onTimerStateRequest: (callback) => {
    ipcRenderer.on('timer:request-state', () => callback());
  },

  // Set blackout state (ABSOLUTE, not toggle)
  setBlackout: (isBlacked) => {
    ipcRenderer.send('blackout:set', isBlacked);
  },

  // Listen for blackout state (ABSOLUTE state, not toggle)
  onBlackoutState: (callback) => {
    ipcRenderer.on('blackout:state', (_event, isBlacked) => callback(isBlacked));
  },

  // ============ Timer Commands ============

  // Timer commands (control -> main -> output)
  sendTimerCommand: (command, config) => {
    ipcRenderer.send('timer:command', { command, config });
  },

  // Listen for timer updates (output window receives these)
  onTimerUpdate: (callback) => {
    ipcRenderer.on('timer:update', (_event, data) => callback(data));
  },

  // Display state sync (control -> output, runs every frame)
  sendDisplayState: (state) => {
    ipcRenderer.send('display:state', state);
  },

  // Listen for display state updates (output window receives these)
  onDisplayUpdate: (callback) => {
    ipcRenderer.on('display:update', (_event, state) => callback(state));
  },

  // Window management
  openOutputWindow: () => {
    ipcRenderer.send('window:open-output');
  },

  fullscreenOutput: () => {
    ipcRenderer.send('window:fullscreen-output');
  },

  // Listen for window events
  onOutputWindowReady: (callback) => {
    ipcRenderer.on('window:output-ready', () => callback());
  },

  onOutputWindowClosed: (callback) => {
    ipcRenderer.on('window:output-closed', () => callback());
  },

  // Signal that viewer is fully initialized and ready to receive state
  signalViewerReady: () => {
    ipcRenderer.send('viewer:ready');
  },

  // Keyboard shortcuts from output window
  sendKeyboardShortcut: (shortcut) => {
    ipcRenderer.send('keyboard:shortcut', shortcut);
  },

  // Listen for keyboard shortcuts (control window receives these)
  onKeyboardShortcut: (callback) => {
    ipcRenderer.on('keyboard:shortcut', (_event, shortcut) => callback(shortcut));
  },

  // Sound alerts
  playSound: (soundType) => {
    ipcRenderer.send('sound:play', soundType);
  },

  // Blackout toggle
  toggleBlackout: () => {
    ipcRenderer.send('blackout:toggle');
  },

  // Listen for blackout toggle (both windows receive)
  onBlackoutToggle: (callback) => {
    ipcRenderer.on('blackout:toggle', () => callback());
  },

  // Get app info
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),

  // Show confirm dialog with app icon
  showConfirm: (options) => ipcRenderer.invoke('dialog:confirm', options),

  // Stay on top settings
  setAlwaysOnTop: (window, value) => {
    ipcRenderer.send('window:set-always-on-top', { window, value });
  },

  getAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top'),

  // Cleanup listeners (call when window closes)
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('timer:state');
    ipcRenderer.removeAllListeners('timer:request-state');
    ipcRenderer.removeAllListeners('timer:update');
    ipcRenderer.removeAllListeners('display:update');
    ipcRenderer.removeAllListeners('window:output-ready');
    ipcRenderer.removeAllListeners('window:output-closed');
    ipcRenderer.removeAllListeners('keyboard:shortcut');
    ipcRenderer.removeAllListeners('blackout:toggle');
    ipcRenderer.removeAllListeners('blackout:state');
  }
});
