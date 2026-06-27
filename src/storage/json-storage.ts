interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function loadJson<T>(storage: StorageLike, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch (_error) {
    return fallback;
  }
}

export function saveJson<T>(storage: StorageLike, key: string, value: T): void {
  storage.setItem(key, JSON.stringify(value));
}

export function createJsonStorage<T>(storage: StorageLike, key: string, fallback: T) {
  return {
    load: () => loadJson(storage, key, fallback),
    save: (value: T) => saveJson(storage, key, value),
    remove: () => storage.removeItem?.(key),
  };
}
