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

  focusOutput: () => {
    ipcRenderer.send('window:focus-output');
  },

  // Listen for window events
  onOutputWindowReady: (callback) => {
    ipcRenderer.on('window:output-ready', () => callback());
  },

  onOutputWindowClosed: (callback) => {
    ipcRenderer.on('window:output-closed', () => callback());
  },

  // Signal that output window is fully initialized and ready to receive state
  signalOutputReady: () => {
    ipcRenderer.send('output:ready');
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
  downloadUpdates: (url) => ipcRenderer.invoke('app:download-updates', url),
  restartApp: () => ipcRenderer.send('app:restart'),

  // Signal that control window is fully initialized (closes splash screen)
  signalAppReady: () => ipcRenderer.send('app:ready'),

  // Report timer running status to main process (for quit confirmation)
  reportTimerRunning: (isRunning) => {
    ipcRenderer.send('timer:running-status', isRunning);
  },

  // Show confirm dialog with app icon
  showConfirm: (options) => ipcRenderer.invoke('dialog:confirm', options),

  // Stay on top settings
  setAlwaysOnTop: (window, value) => {
    ipcRenderer.send('window:set-always-on-top', { window, value });
  },

  getAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top'),

  // Set window background color (for theme switching)
  setBackgroundColor: (window, color) => {
    ipcRenderer.send('window:set-background-color', { window, color });
  },

  // ============ Message Broadcasting ============

  // Send message to output (control -> main -> output)
  sendMessage: (message) => {
    ipcRenderer.send('message:send', message);
  },

  // Listen for message updates (output receives)
  onMessageUpdate: (callback) => {
    ipcRenderer.on('message:update', (_event, message) => callback(message));
  },

  // Request current message state (output -> control, on load/reload)
  requestMessageState: () => {
    ipcRenderer.send('message:request-state');
  },

  // Listen for message state requests (control responds)
  onMessageStateRequest: (callback) => {
    ipcRenderer.on('message:request-state', () => callback());
  },

  // ============ Settings Window ============

  // Open settings window with a specific timer
  openSettingsWindow: (timerIndex) => {
    ipcRenderer.send('window:open-settings', timerIndex);
  },

  // Close settings window
  closeSettingsWindow: () => {
    ipcRenderer.send('window:close-settings');
  },

  // Listen for settings window ready (control receives)
  onSettingsWindowReady: (callback) => {
    ipcRenderer.on('window:settings-ready', () => callback());
  },

  // Listen for settings window closed (control receives)
  onSettingsWindowClosed: (callback) => {
    ipcRenderer.on('window:settings-closed', () => callback());
  },

  // Signal that settings window is ready (settings window calls this)
  signalSettingsReady: () => {
    ipcRenderer.send('settings:ready');
  },

  // Settings window requests timer data
  requestSettingsTimer: (timerIndex) => {
    ipcRenderer.send('settings:request-timer', timerIndex);
  },

  // Listen for timer data request (control receives, responds with timer data)
  onSettingsTimerRequest: (callback) => {
    ipcRenderer.on('settings:request-timer', (_event, timerIndex) => callback(timerIndex));
  },

  // Send timer data to settings window (control sends)
  sendSettingsTimerData: (data) => {
    ipcRenderer.send('settings:timer-data', data);
  },

  // Listen for timer data (settings window receives)
  onSettingsTimerData: (callback) => {
    ipcRenderer.on('settings:timer-data', (_event, data) => callback(data));
  },

  // Save timer from settings window
  saveSettingsTimer: (data) => {
    ipcRenderer.send('settings:save-timer', data);
  },

  // Listen for timer save (control receives)
  onSettingsTimerSave: (callback) => {
    ipcRenderer.on('settings:save-timer', (_event, data) => callback(data));
  },

  // Tell settings window to load a different timer (control sends when selection changes)
  sendSettingsLoadTimer: (timerIndex) => {
    ipcRenderer.send('settings:load-timer', timerIndex);
  },

  // Listen for load timer request (settings window receives)
  onSettingsLoadTimer: (callback) => {
    ipcRenderer.on('settings:load-timer', (_event, timerIndex) => callback(timerIndex));
  },

  // Listen for initial timer index (settings window receives on window creation)
  onSettingsInit: (callback) => {
    ipcRenderer.on('settings:init', (_event, timerIndex) => callback(timerIndex));
  },

  // Listen for window bounds update (control receives, saves to localStorage)
  onSettingsWindowBounds: (callback) => {
    ipcRenderer.on('settings:window-bounds', (_event, bounds) => callback(bounds));
  },

  // ============ OSC Integration ============

  // Get OSC settings
  oscGetSettings: () => ipcRenderer.invoke('osc:get-settings'),

  // Update OSC settings
  oscSetSettings: (settings) => ipcRenderer.invoke('osc:set-settings', settings),

  // Send OSC feedback message
  oscSendFeedback: (address, args) => ipcRenderer.invoke('osc:send-feedback', { address, args }),

  // Listen for OSC commands (control window receives)
  onOSCCommand: (callback) => {
    ipcRenderer.on('osc:command', (_event, data) => callback(data));
  },

  // ============ Custom Sounds ============

  // List all custom sounds
  soundsList: () => ipcRenderer.invoke('sounds:list'),

  // Upload a custom sound
  soundsUpload: (data) => ipcRenderer.invoke('sounds:upload', data),

  // Delete a custom sound
  soundsDelete: (soundId) => ipcRenderer.invoke('sounds:delete', soundId),

  // Get sound file data (for playback)
  soundsGetData: (soundId) => ipcRenderer.invoke('sounds:get-data', soundId),

  // Open file dialog to select sound
  soundsSelectFile: () => ipcRenderer.invoke('sounds:select-file'),

  // Cleanup listeners (call when window closes)
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('timer:state');
    ipcRenderer.removeAllListeners('timer:request-state');
    ipcRenderer.removeAllListeners('timer:update');
    ipcRenderer.removeAllListeners('display:update');
    ipcRenderer.removeAllListeners('window:output-ready');
    ipcRenderer.removeAllListeners('window:output-closed');
    ipcRenderer.removeAllListeners('window:settings-ready');
    ipcRenderer.removeAllListeners('window:settings-closed');
    ipcRenderer.removeAllListeners('keyboard:shortcut');
    ipcRenderer.removeAllListeners('blackout:toggle');
    ipcRenderer.removeAllListeners('blackout:state');
    ipcRenderer.removeAllListeners('message:update');
    ipcRenderer.removeAllListeners('osc:command');
    ipcRenderer.removeAllListeners('settings:request-timer');
    ipcRenderer.removeAllListeners('settings:timer-data');
    ipcRenderer.removeAllListeners('settings:save-timer');
    ipcRenderer.removeAllListeners('settings:load-timer');
    ipcRenderer.removeAllListeners('settings:init');
    ipcRenderer.removeAllListeners('settings:window-bounds');
  }
});
