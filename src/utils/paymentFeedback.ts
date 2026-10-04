/** Optional silent tactile feedback; browsers without vibration retain visual feedback. */
export function paymentFeedback(success = false) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { navigator.vibrate?.(success ? [8, 30, 12] : 8); } catch { /* optional hardware feature */ }
}
