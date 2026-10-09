import { create } from 'zustand';

/** Build stamp so a cached old bundle can't pass for the new one on a phone. */
export const BUILD_TAG: string = typeof __BUILD_TAG__ === 'string' ? __BUILD_TAG__ : 'dev';

export function diagEnabled(): boolean {
  try {
    return /[?&]diag=1/.test(location.search) || /[?&]diag=1/.test(location.hash) || localStorage.getItem('fibu:diag') === '1';
  } catch {
    return false;
  }
}

interface DiagState {
  entries: Record<string, string>;
  log: (key: string, value: unknown) => void;
}

/**
 * Tiny on-screen readout for bugs only a real iPhone shows: camera errors,
 * video state, AI failures. Visible only with ?diag=1, so a screenshot tells us
 * exactly which code path the phone took.
 */
export const useDiag = create<DiagState>((set) => ({
  entries: {},
  log: (key, value) =>
    set((s) => ({ entries: { ...s.entries, [key]: typeof value === 'string' ? value : JSON.stringify(value) } })),
}));

export const diag = (key: string, value: unknown) => {
  if (diagEnabled()) useDiag.getState().log(key, value);
};
