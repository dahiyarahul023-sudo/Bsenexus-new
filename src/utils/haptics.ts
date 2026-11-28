/**
 * Tactile & Acoustic Micro-Feedback Utility
 * Provides native hardware vibration on mobile and synthesized micro-ticks
 * via Web Audio API for an authentic Apple-grade tactile feel.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Triggered at the exact instant the pull crosses the threshold.
 * Arms the user's thumb before they release.
 */
export function triggerThresholdTick() {
  // The on-screen indicator also works on devices without vibration support.
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(10); } catch {}
  }
}

/**
 * Triggered when a refresh completes successfully.
 */
export function triggerSuccessHaptic() {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([8, 30, 12]);
    } catch {}
  }
}

/** Quiet navigation feedback; visual pressed state remains available without vibration. */
export function triggerNavigationHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(8); } catch { /* Device may not support vibration. */ }
  }
}

/**
 * Instant pointer-down / tap micro-haptic (Apple Taptic Engine light tap).
 */
export function triggerTapHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(6); } catch {}
  }
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.009);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.009);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.01);
  } catch {}
}

/**
 * Distinct two-pulse stage-step haptic when crossing or selecting a new page section.
 */
export function triggerStageHaptic(stageIndex: number = 0) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate([7, 20, 11]); } catch {}
  }
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const baseFreq = 320 + (stageIndex % 5) * 45;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.018);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.024);
  } catch {}
}

