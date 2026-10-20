/**
 * True inside the Tauri desktop shell. Tauri injects this global before any app script runs,
 * so the answer is fixed for the page's lifetime and safe to read at module load.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
