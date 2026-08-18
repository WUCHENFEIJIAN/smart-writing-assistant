import { settingsStoreSchema } from "@shared/validation";
import { DEFAULT_GENERATION_PARAMS, type SettingsStore } from "@shared/types/writing";
import { readStorage, resolveBrowserStorage, writeStorage, type StorageReadResult, type StorageWriteResult } from "./core";

export const SETTINGS_STORAGE_KEY = "smart-writer:settings:v1";
export const DEFAULT_SETTINGS: SettingsStore = {
  schemaVersion: 1,
  activeMode: "continue",
  params: DEFAULT_GENERATION_PARAMS,
};

export function loadSettings(storage: Storage | null = resolveBrowserStorage()): StorageReadResult<SettingsStore> {
  return readStorage(SETTINGS_STORAGE_KEY, settingsStoreSchema, DEFAULT_SETTINGS, storage);
}

export function saveSettings(
  settings: SettingsStore,
  storage: Storage | null = resolveBrowserStorage(),
): StorageWriteResult {
  return writeStorage(SETTINGS_STORAGE_KEY, settings, storage);
}

