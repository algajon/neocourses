import { create } from 'zustand';
import { ModelSettings } from '../lib/types';
import { loadSettings, saveSettings } from '../lib/storage';

// Primary model is the on-prem DGX Spark cluster (Qwen, OpenAI-compatible).
// Base URL omits /v1 — the Rust layer appends /v1/chat/completions.
const DEFAULT_SETTINGS: ModelSettings = {
  schemaVersion: 1,
  baseUrl: 'http://192.168.1.50:8000',
  apiKey: import.meta.env.VITE_DGX_API_KEY ?? '',
  model: 'Qwen/Qwen2.5-72B-Instruct',
  tier: 'heavy',
};

type SettingsStore = {
  settings: ModelSettings;
  loadFromStorage: () => void;
  updateSettings: (updates: Partial<ModelSettings>) => void;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  loadFromStorage: () => set({ settings: { ...DEFAULT_SETTINGS, ...(loadSettings() ?? {}) } }),
  updateSettings: (updates) =>
    set(s => {
      const updated = { ...s.settings, ...updates };
      saveSettings(updated);
      return { settings: updated };
    }),
}));
