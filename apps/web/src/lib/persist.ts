import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import Dexie, { type Table } from "dexie";

/**
 * The disk copy of the query cache.
 *
 * Dexie is the one IndexedDB library. It stores the cache now, and it is the
 * base the local document store will sit on next, so there is no second library
 * to swap later. A cold start reads the last session's library and documents
 * from here without a network round trip.
 */
export const MAX_AGE = 24 * 60 * 60 * 1000;

interface CacheRow {
  key: string;
  value: string;
}

class CurioDb extends Dexie {
  cache!: Table<CacheRow, string>;

  constructor() {
    super("curio");
    this.version(1).stores({ cache: "key" });
  }
}

let db: CurioDb | null = null;

/**
 * IndexedDB only exists in the browser. The persister reaches this from effects,
 * so a server render never opens the database.
 */
function database(): CurioDb {
  db ??= new CurioDb();
  return db;
}

const storage = {
  getItem: async (key: string) => (await database().cache.get(key))?.value ?? null,
  setItem: async (key: string, value: string) => {
    await database().cache.put({ key, value });
  },
  removeItem: async (key: string) => {
    await database().cache.delete(key);
  },
};

export const persister = createAsyncStoragePersister({
  storage,
  key: "curio-query-cache",
  throttleTime: 1000,
});

/** Drop the disk cache. Sign-out must not leave the old identity's documents. */
export async function clearPersistedCache(): Promise<void> {
  await persister.removeClient();
}
