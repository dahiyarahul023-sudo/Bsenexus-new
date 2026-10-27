import { useSyncExternalStore, useCallback } from 'react';

const STORAGE_KEY = 'nexus_dev_terminal_mode';
const EVENT_NAME = 'nexus_dev_mode_changed';

export function isDeveloperTerminalModeEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDeveloperTerminalMode(enabled: boolean): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { enabled } }));
    }
  } catch (e) {
    console.warn('Could not save developer terminal mode:', e);
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(EVENT_NAME, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(EVENT_NAME, callback);
  };
}

function getSnapshot(): boolean {
  return isDeveloperTerminalModeEnabled();
}

function getServerSnapshot(): boolean {
  return false;
}

export function useDeveloperMode(): [boolean, (val: boolean) => void] & { isDeveloperMode: boolean; setDeveloperMode: (val: boolean) => void; isDevMode: boolean } {
  const isDevMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((val: boolean) => {
    setDeveloperTerminalMode(val);
  }, []);

  const result: any = [isDevMode, toggle];
  result.isDeveloperMode = isDevMode;
  result.isDevMode = isDevMode;
  result.setDeveloperMode = toggle;

  return result;
}
