import { openDB, type IDBPDatabase } from "idb";
import type { AppData } from "./types";
import { EMPTY_DATA } from "./types";

const DB_NAME = "lipipulse";
const STORE = "kv";
const KEY = "appdata";

let handle: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!handle) {
    handle = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      },
    });
  }
  return handle;
}

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export async function loadState(): Promise<AppData | null> {
  if (!isBrowser()) return null;
  try {
    const val = (await (await db()).get(STORE, KEY)) as AppData | undefined;
    if (!val || !Array.isArray(val.channels)) return null;
    return { ...EMPTY_DATA, ...val, settings: { ...EMPTY_DATA.settings, ...(val.settings ?? {}) } };
  } catch {
    return null;
  }
}

export async function saveState(data: AppData): Promise<void> {
  if (!isBrowser()) return;
  try {
    await (await db()).put(STORE, data, KEY);
  } catch (err) {
    console.warn("LipiPulse: could not persist state", err);
  }
}

export async function wipeState(): Promise<void> {
  if (!isBrowser()) return;
  try {
    await (await db()).delete(STORE, KEY);
  } catch {
    /* ignore */
  }
}
