import type { ReadyPackageAsset } from "./ready-package-types";

const DB_NAME = "elvy-ready-package-assets";
const DB_VERSION = 1;
const STORE_NAME = "assets";

export type StoredReadyPackageAsset = {
  key: string;
  packageId: string;
  assetId: string;
  lessonId: string;
  metadata: ReadyPackageAsset;
  blob: Blob;
  storedAt: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("packageId", "packageId", { unique: false });
        store.createIndex("lessonId", "lessonId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Could not open package asset storage."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("Asset storage transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error || new Error("Asset storage transaction was aborted."));
  });
}

export const ReadyPackageAssetStorage = {
  async storeAssets(
    packageId: string,
    assets: Array<{ metadata: ReadyPackageAsset; blob: Blob }>,
  ): Promise<void> {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    for (const asset of assets) {
      const record: StoredReadyPackageAsset = {
        key: `${packageId}:${asset.metadata.id}`,
        packageId,
        assetId: asset.metadata.id,
        lessonId: asset.metadata.lessonId,
        metadata: asset.metadata,
        blob: asset.blob,
        storedAt: new Date().toISOString(),
      };
      store.put(record);
    }

    await transactionDone(transaction);
    db.close();
  },

  async getAsset(
    packageId: string,
    assetId: string,
  ): Promise<StoredReadyPackageAsset | null> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(`${packageId}:${assetId}`);

      request.onsuccess = () => {
        db.close();
        resolve((request.result as StoredReadyPackageAsset) || null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error || new Error("Could not read package asset."));
      };
    });
  },

  async getLessonAssets(
    lessonId: string,
  ): Promise<StoredReadyPackageAsset[]> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .index("lessonId")
        .getAll(lessonId);

      request.onsuccess = () => {
        db.close();
        resolve((request.result as StoredReadyPackageAsset[]) || []);
      };
      request.onerror = () => {
        db.close();
        reject(request.error || new Error("Could not read lesson assets."));
      };
    });
  },

  async deletePackage(packageId: string): Promise<number> {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("packageId");
    const keysRequest = index.getAllKeys(packageId);

    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      keysRequest.onsuccess = () => resolve(keysRequest.result);
      keysRequest.onerror = () =>
        reject(keysRequest.error || new Error("Could not list package assets."));
    });

    keys.forEach((key) => store.delete(key));
    await transactionDone(transaction);
    db.close();
    return keys.length;
  },
};
