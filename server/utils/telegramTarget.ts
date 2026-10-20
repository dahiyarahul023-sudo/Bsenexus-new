/** Resolve a personal destination without ever falling back to the shared channel. */
export function resolvePersonalTelegramTarget(stored: unknown, requested: unknown, shared: unknown): string {
  const target = typeof stored === 'string' ? stored.trim() : '';
  const selected = typeof requested === 'string' ? requested.trim() : '';
  const globalTarget = typeof shared === 'string' ? shared.trim() : '';
  if (!target || target === globalTarget || (selected && selected !== target)) {
    throw new Error('Configure your own Telegram destination. Shared-channel broadcasts require an administrator.');
  }
  return target;
}
