/**
 * Hawkario - Sound Utilities
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
 * Play end sound (ascending tones)
 * @param {number} volume - Volume from 0 to 1
 */
export function playEndSound(volume = 0.5) {
  const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  frequencies.forEach((freq, i) => {
    setTimeout(() => {
      playBeep({ frequency: freq, duration: 0.25, type: 'sine', volume });
    }, i * 150);
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
 * Sound types mapped to their play functions
 */
export const SOUND_PLAYERS = {
  warning: playWarningSound,
  end: playEndSound,
  tick: playTickSound
};

/**
 * Play a sound by type
 * @param {string} type - Sound type: 'warning', 'end', 'tick'
 * @param {number} volume - Volume from 0 to 1
 */
export function playSound(type, volume = 0.5) {
  const player = SOUND_PLAYERS[type];
  if (player) {
    player(volume);
  }
}
