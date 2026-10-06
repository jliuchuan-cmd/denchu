// IndexedDB に電柱データを保存する小さなラッパー。
// 写真を含むため localStorage（約5MB上限）ではなく IndexedDB を使う。
const PoleDB = (() => {
  const DB_NAME = 'denchu';
  const STORE = 'poles';
  let dbPromise;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const result = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      t.onerror = () => reject(t.error);
    });
  }

  return {
    all: () => tx('readonly', (s) => s.getAll()),
    put: (pole) => tx('readwrite', (s) => s.put(pole)),
    remove: (id) => tx('readwrite', (s) => s.delete(id)),
  };
})();
