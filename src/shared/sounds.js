/**
 * Ninja Timer - Sound Utilities
 * Audio alerts using Web Audio API
 */

let audioContext = null;

/**
 * Initialize audio context (must be called after user interaction)
 */
export function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play a beep sound
 * @param {Object} options - Sound options
 * @param {number} options.frequency - Frequency in Hz (default: 800)
 * @param {number} options.duration - Duration in seconds (default: 0.2)
 * @param {string} options.type - Oscillator type: 'sine', 'square', 'triangle', 'sawtooth' (default: 'sine')
 * @param {number} options.volume - Volume from 0 to 1 (default: 0.5)
 */
export function playBeep({
  frequency = 800,
  duration = 0.2,
  type = 'sine',
  volume = 0.5
} = {}) {
  const ctx = initAudio();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = type;

  // Envelope for smoother sound
  const now = ctx.currentTime;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
  gainNode.gain.linearRampToValueAtTime(volume * 0.7, now + duration * 0.5);
  gainNode.gain.linearRampToValueAtTime(0, now + duration);

  oscillator.start(now);
  oscillator.stop(now + duration);
}

/**
 * Play warning sound (two quick beeps)
 * @param {number} volume - Volume from 0 to 1
 */
export function playWarningSound(volume = 0.5) {
  playBeep({ frequency: 880, duration: 0.15, type: 'sine', volume });
  setTimeout(() => {
    playBeep({ frequency: 880, duration: 0.15, type: 'sine', volume });
  }, 200);
}

/**
 * Play chime sound (ascending chord) - C5, E5, G5, C6
 * @param {number} volume - Volume from 0 to 1
 */
export function playChimeSound(volume = 0.5) {
  const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  frequencies.forEach((freq, i) => {
    setTimeout(() => {
      playBeep({ frequency: freq, duration: 0.25, type: 'sine', volume });
    }, i * 150);
  });
}

// Alias for backward compatibility
export const playEndSound = playChimeSound;

/**
 * Play bell sound - resonant bell-like tone with harmonics
 * @param {number} volume - Volume from 0 to 1
 */
export function playBellSound(volume = 0.5) {
  const ctx = initAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 1.5;

  // Bell has fundamental + harmonics that decay at different rates
  const harmonics = [
    { freq: 440, amp: 1.0, decay: 1.5 },    // Fundamental A4
    { freq: 880, amp: 0.5, decay: 1.0 },    // 2nd harmonic
    { freq: 1320, amp: 0.25, decay: 0.7 },  // 3rd harmonic
    { freq: 1760, amp: 0.125, decay: 0.5 }  // 4th harmonic
  ];

  harmonics.forEach(h => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = h.freq;
    osc.type = 'sine';

    gain.gain.setValueAtTime(volume * h.amp, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + h.decay);

    osc.start(now);
    osc.stop(now + duration);
  });
}

/**
 * Play alert sound - two-tone urgent beep
 * @param {number} volume - Volume from 0 to 1
 */
export function playAlertSound(volume = 0.5) {
  // Alternating high-low tones
  const pattern = [
    { freq: 880, delay: 0 },
    { freq: 660, delay: 150 },
    { freq: 880, delay: 300 },
    { freq: 660, delay: 450 }
  ];

  pattern.forEach(p => {
    setTimeout(() => {
      playBeep({ frequency: p.freq, duration: 0.12, type: 'square', volume: volume * 0.7 });
    }, p.delay);
  });
}

/**
 * Play gong sound - deep resonant tone
 * @param {number} volume - Volume from 0 to 1
 */
export function playGongSound(volume = 0.5) {
  const ctx = initAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 2.5;

  // Deep fundamental with rich harmonics
  const harmonics = [
    { freq: 110, amp: 1.0, decay: 2.5 },    // A2 - deep fundamental
    { freq: 220, amp: 0.6, decay: 2.0 },    // A3
    { freq: 277, amp: 0.3, decay: 1.5 },    // C#4 (slightly dissonant)
    { freq: 330, amp: 0.2, decay: 1.2 },    // E4
    { freq: 440, amp: 0.15, decay: 0.8 }    // A4
  ];

  harmonics.forEach(h => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = h.freq;
    osc.type = 'sine';

    // Attack + decay envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * h.amp, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + h.decay);

    osc.start(now);
    osc.stop(now + duration);
  });
}

/**
 * Play soft sound - gentle notification
 * @param {number} volume - Volume from 0 to 1
 */
export function playSoftSound(volume = 0.5) {
  const ctx = initAudio();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Two gentle tones - soft major third
  const notes = [
    { freq: 392, delay: 0, dur: 0.4 },      // G4
    { freq: 523.25, delay: 0.15, dur: 0.5 } // C5
  ];

  notes.forEach(n => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = n.freq;
    osc.type = 'sine';

    const startTime = now + n.delay;
    // Very soft envelope
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume * 0.6, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + n.dur);

    osc.start(startTime);
    osc.stop(startTime + n.dur + 0.1);
  });
}

/**
 * Play a simple tick sound
 * @param {number} volume - Volume from 0 to 1
 */
export function playTickSound(volume = 0.3) {
  playBeep({ frequency: 1000, duration: 0.05, type: 'square', volume: volume * 0.5 });
}

/**
 * Available sound options for UI
 */
export const SOUND_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'chime', label: 'Chime' },
  { value: 'bell', label: 'Bell' },
  { value: 'alert', label: 'Alert' },
  { value: 'gong', label: 'Gong' },
  { value: 'soft', label: 'Soft' }
];

/**
 * Sound types mapped to their play functions
 */
export const SOUND_PLAYERS = {
  warning: playWarningSound,
  end: playChimeSound,  // Legacy alias
  chime: playChimeSound,
  bell: playBellSound,
  alert: playAlertSound,
  gong: playGongSound,
  soft: playSoftSound,
  tick: playTickSound
};

/**
 * Play a sound by type
 * @param {string} type - Sound type: 'chime', 'bell', 'alert', 'gong', 'soft', etc.
 * @param {number} volume - Volume from 0 to 1
 */
export function playSound(type, volume = 0.5) {
  const player = SOUND_PLAYERS[type];
  if (player) {
    player(volume);
  }
}
