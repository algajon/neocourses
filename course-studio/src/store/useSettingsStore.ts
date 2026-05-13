import { create } from 'zustand';
import { ModelSettings } from '../lib/types';
import { loadSettings, saveSettings } from '../lib/storage';

const DEFAULT_SETTINGS: ModelSettings = {
  schemaVersion: 1,
  baseUrl: 'https://api.openai.com',
  apiKey: '',
  model: 'gpt-4o-mini',
};

type SettingsStore = {
  settings: ModelSettings;
  loadFromStorage: () => void;
  updateSettings: (updates: Partial<ModelSettings>) => void;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  loadFromStorage: () => set({ settings: loadSettings() ?? DEFAULT_SETTINGS }),
  updateSettings: (updates) =>
    set(s => {
      const updated = { ...s.settings, ...updates };
      saveSettings(updated);
      return { settings: updated };
    }),
}));
