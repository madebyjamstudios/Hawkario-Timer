/**
 * Hawkario - Preload Script
 * Secure IPC bridge between renderer processes and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API to renderer processes
contextBridge.exposeInMainWorld('hawkario', {
  // Timer commands (control -> main -> output)
  sendTimerCommand: (command, config) => {
    ipcRenderer.send('timer:command', { command, config });
  },

  // Listen for timer updates (output window receives these)
  onTimerUpdate: (callback) => {
    ipcRenderer.on('timer:update', (_event, data) => callback(data));
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

  // Get app info
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Cleanup listeners (call when window closes)
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('timer:update');
    ipcRenderer.removeAllListeners('window:output-ready');
    ipcRenderer.removeAllListeners('keyboard:shortcut');
  }
});
