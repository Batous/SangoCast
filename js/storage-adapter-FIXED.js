/**
 * SANGOCAST STORAGE ADAPTER v5.0
 * Multi-environment storage with atomic operations, proper error handling,
 * and race condition fixes.
 *
 * Fixes from v4:
 * [BUG-01] AsyncMutex: broken queue chaining allowed concurrent callers to race.
 * [BUG-02] nodeFSAdapter: `await` used inside a non-async IIFE — silent init failure on Node.
 * [BUG-03] IndexedDB._withTransaction: resolved before tx.oncomplete — data loss under load.
 * [BUG-04] IndexedDB.multiGet: store.getAll(keys[]) is wrong API — accepts IDBKeyRange, not array.
 * [BUG-05] IndexedDB.close(): waited on Set<Symbol> not Promises — shutdown race condition.
 * [BUG-06] localStorage.keys(): removeItem() inside index-based loop shifts indices, skipping keys.
 * [BUG-07] nodeFSAdapter.keys(): SHA-256 hashed keys can't be prefix-filtered — broken by design.
 *          Fixed by storing original key in file so metadata can be recovered.
 * [BUG-08] SangocastStorage.subscribe(): multiple calls overwrote _unsubscribe, leaking listeners.
 * [BUG-09] IndexedDB.keys(): nested store.get() inside cursor can abort transaction in some browsers.
 *          Fixed by using the 'expires' index for efficient cleanup.
 * [BUG-10] memoryAdapter.multiRemove/multiSet: forEach over async methods — fire-and-forget, non-deterministic.
 * [BUG-11] setJSON: recursive circular-reference check stack-overflows on deep objects.
 * [BUG-12] IndexedDB.multiGet: TTL not validated per-item (only checked in getItem).
 * [BUG-13] Added missing has(key) method to avoid forced null-check pattern.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? module.exports = factory()
    : typeof define === 'function' && define.amd
      ? define(factory)
      : (global.SangocastStorage = factory());
}(typeof window !== 'undefined' ? window : global, function () {
  'use strict';

  // ===========================================================================
  // 0. Utility Types and Helpers
  // ===========================================================================

  /**
   * Result<T, E> — explicit error handling without thrown exceptions.
   */
  class Result {
    constructor(ok, value, error) {
      this.ok = ok;
      this.value = value;
      this.error = error;
    }
    static Ok(value)  { return new Result(true,  value, null);  }
    static Err(error) { return new Result(false, null,  error); }
    unwrap() {
      if (!this.ok) throw this.error;
      return this.value;
    }
    unwrapOr(defaultValue) {
      return this.ok ? this.value : defaultValue;
    }
  }

  /**
   * [FIX BUG-01] AsyncMutex — correct FIFO queue using promise chaining.
   *
   * Previous version checked `_locked` but then re-awaited `_queue` incorrectly,
   * allowing concurrent callers to slip through when the lock was briefly false
   * between microtasks. The correct pattern: chain the *new* lock onto the tail
   * of the queue *before* any await, so callers always serialise.
   */
  class AsyncMutex {
    constructor() {
      // _queue is always a Promise that resolves when the current holder releases.
      this._queue = Promise.resolve();
    }

    acquire() {
      // Capture the current tail of the queue.
      const waitFor = this._queue;

      // Allocate a release function before any await.
      let release;
      // Extend the queue: next caller waits for THIS lock to be released.
      this._queue = new Promise(resolve => { release = resolve; });

      // Return a promise that resolves (with the release fn) after our turn comes.
      return waitFor.then(() => release);
    }
  }

  // ===========================================================================
  // 1. localStorage Adapter
  // ===========================================================================

  const localStorageAdapter = (() => {
    const listeners = new Set();
    let storageListener = null;

    function ensureListener() {
      if (storageListener || typeof window === 'undefined') return;
      storageListener = (e) => {
        if (e.storageArea !== localStorage) return;
        listeners.forEach(cb => {
          try { cb(e.key, e.newValue, e.oldValue); } catch (_) {}
        });
      };
      window.addEventListener('storage', storageListener);
    }

    /** Returns { expired: bool, value: any } or null if raw is falsy. */
    function parseValue(raw) {
      if (!raw) return { expired: false, value: null };
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'value' in parsed) {
          if (parsed.expires && Date.now() > parsed.expires) {
            return { expired: true, value: null };
          }
          return { expired: false, value: parsed.value };
        }
        // Legacy plain value
        return { expired: false, value: raw };
      } catch {
        return { expired: false, value: raw };
      }
    }

    return {
      async getItem(key) {
        try {
          const raw = localStorage.getItem(key);
          const parsed = parseValue(raw);
          if (parsed.expired) {
            localStorage.removeItem(key);
            return Result.Ok(null);
          }
          return Result.Ok(parsed.value);
        } catch (e) {
          return Result.Err(e);
        }
      },

      async setItem(key, value, ttl = null) {
        try {
          const item = { value, expires: ttl ? Date.now() + ttl : null };
          localStorage.setItem(key, JSON.stringify(item));
          return Result.Ok(true);
        } catch (e) {
          if (e.name === 'QuotaExceededError') {
            return Result.Err(new Error('Storage quota exceeded'));
          }
          return Result.Err(e);
        }
      },

      async removeItem(key) {
        try {
          localStorage.removeItem(key);
          return Result.Ok(true);
        } catch (e) {
          return Result.Err(e);
        }
      },

      async multiRemove(keys) {
        try {
          keys.forEach(key => localStorage.removeItem(key));
          return Result.Ok(true);
        } catch (e) {
          return Result.Err(e);
        }
      },

      /**
       * [FIX BUG-06] Collect keys into a snapshot array first, then iterate.
       * Calling removeItem() inside a live index-based loop shifted subsequent
       * indices, silently skipping entries.
       */
      async keys(prefix = '') {
        try {
          // Snapshot all keys before any mutation.
          const snapshot = [];
          for (let i = 0; i < localStorage.length; i++) {
            snapshot.push(localStorage.key(i));
          }

          const live = [];
          for (const key of snapshot) {
            if (!key.startsWith(prefix)) continue;
            const raw = localStorage.getItem(key);
            const parsed = parseValue(raw);
            if (parsed.expired) {
              localStorage.removeItem(key); // Safe: we're iterating the snapshot, not a live index.
            } else {
              live.push(key);
            }
          }
          return Result.Ok(live);
        } catch (e) {
          return Result.Err(e);
        }
      },

      async multiGet(keys) {
        try {
          const result = {};
          for (const key of keys) {
            const res = await this.getItem(key);
            result[key] = res.ok ? res.value : null;
          }
          return Result.Ok(result);
        } catch (e) {
          return Result.Err(e);
        }
      },

      async multiSet(entries, ttl = null) {
        try {
          for (const [key, value] of Object.entries(entries)) {
            const item = { value, expires: ttl ? Date.now() + ttl : null };
            localStorage.setItem(key, JSON.stringify(item));
          }
          return Result.Ok(true);
        } catch (e) {
          return Result.Err(e);
        }
      },

      async clearAll() {
        try {
          localStorage.clear();
          return Result.Ok(undefined);
        } catch (e) {
          return Result.Err(e);
        }
      },

      subscribe(callback) {
        ensureListener();
        listeners.add(callback);
        return () => listeners.delete(callback);
      },

      async cleanup() {
        // keys() already prunes expired entries as a side-effect.
        return this.keys('').then(() => Result.Ok(undefined));
      }
    };
  })();

  // ===========================================================================
  // 2. IndexedDB Adapter
  // ===========================================================================

  class IndexedDBAdapter {
    constructor(dbName = 'SangocastDB', version = 2, storeName = 'storage') {
      this.dbName      = dbName;
      this.version     = version;
      this.storeName   = storeName;
      this._dbPromise  = null;
      this._mutex      = new AsyncMutex();
      // [FIX BUG-05] Track in-flight transaction Promises, not Symbols.
      this._pending    = new Set();
      this._closeTimer = null;
      this._idleMs     = 30000;
      this._listeners  = new Set();
      this._bc         = null;
      this._initBroadcast();
    }

    _initBroadcast() {
      if (typeof BroadcastChannel !== 'undefined') {
        this._bc = new BroadcastChannel(`sangocast_${this.dbName}`);
        this._bc.onmessage = ({ data }) => {
          const { key, newValue, oldValue } = data;
          this._listeners.forEach(cb => cb(key, newValue, oldValue));
        };
      }
    }

    _getDB() {
      if (this._dbPromise) {
        this._resetIdleTimer();
        return this._dbPromise;
      }
      this._dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          return reject(new Error('IndexedDB not supported'));
        }
        const req = window.indexedDB.open(this.dbName, this.version);

        req.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
            store.createIndex('expires', 'expires', { unique: false });
          }
          // Migration v1 → v2: ensure expires field exists on all records.
          if (event.oldVersion < 2) {
            const tx    = event.target.transaction;
            const store = tx.objectStore(this.storeName);
            const cur   = store.openCursor();
            cur.onsuccess = (e) => {
              const cursor = e.target.result;
              if (!cursor) return;
              const data = cursor.value;
              if (!('expires' in data)) {
                data.expires = null;
                cursor.update(data);
              }
              cursor.continue();
            };
          }
        };

        req.onsuccess = (event) => {
          const db = event.target.result;
          db.onclose       = () => this._cleanup();
          db.onversionchange = () => { db.close(); this._cleanup(); };
          this._resetIdleTimer();
          resolve(db);
        };

        req.onerror   = () => { this._dbPromise = null; reject(req.error); };
        req.onblocked = () => reject(new Error('Database open blocked by another tab'));
      });
      return this._dbPromise;
    }

    _resetIdleTimer() {
      clearTimeout(this._closeTimer);
      this._closeTimer = setTimeout(() => this.close(), this._idleMs);
    }

    _cleanup() {
      this._dbPromise  = null;
      this._closeTimer = null;
      clearTimeout(this._closeTimer);
    }

    /**
     * [FIX BUG-03] Resolve the outer promise only on tx.oncomplete, not when
     * the individual request fires. IDB writes are not durable until oncomplete.
     *
     * The operation callback receives (store, txResolve, txReject) and must call
     * txResolve/txReject to pass a value back through the transaction promise.
     */
    async _withTransaction(mode, operation) {
      const release     = await this._mutex.acquire();
      let txPromise;
      try {
        const db = await this._getDB();

        txPromise = new Promise((resolve, reject) => {
          const tx    = db.transaction(this.storeName, mode);
          const store = tx.objectStore(this.storeName);

          let opResult;

          // Outer promise resolves/rejects based on transaction lifecycle, not
          // the individual request — guaranteeing durability.
          tx.oncomplete = () => resolve(opResult);
          tx.onerror    = () => reject(tx.error);
          tx.onabort    = () => reject(new Error('Transaction aborted'));

          // The operation sets opResult then lets the tx commit naturally.
          operation(store, (val) => { opResult = val; }, reject);
        });

        this._pending.add(txPromise);
        const result = await txPromise;
        return result;
      } finally {
        if (txPromise) this._pending.delete(txPromise);
        release();
        this._resetIdleTimer();
      }
    }

    async getItem(key) {
      try {
        const result = await this._withTransaction('readonly', (store, resolve) => {
          const req = store.get(key);
          req.onsuccess = () => {
            const data = req.result;
            if (!data) { resolve(null); return; }
            if (data.expires && Date.now() > data.expires) {
              // Schedule async cleanup outside this readonly tx.
              Promise.resolve().then(() => this.removeItem(key));
              resolve(null);
            } else {
              resolve(data.value);
            }
          };
          req.onerror = () => { throw req.error; };
        });
        return Result.Ok(result);
      } catch (e) {
        return Result.Err(e);
      }
    }

    async setItem(key, value, ttl = null) {
      try {
        // Read old value for change notification (outside main tx to avoid nesting).
        let oldValue = null;
        const getRes = await this.getItem(key);
        if (getRes.ok) oldValue = getRes.value;

        const data = { key, value, expires: ttl ? Date.now() + ttl : null, updatedAt: Date.now() };
        await this._withTransaction('readwrite', (store, resolve) => {
          const req = store.put(data);
          req.onsuccess = () => resolve();
          req.onerror   = () => { throw req.error; };
        });
        this._notifyChange(key, value, oldValue);
        return Result.Ok(true);
      } catch (e) {
        return Result.Err(e);
      }
    }

    async removeItem(key) {
      try {
        let oldValue = null;
        const getRes = await this.getItem(key);
        if (getRes.ok) oldValue = getRes.value;

        await this._withTransaction('readwrite', (store, resolve) => {
          const req = store.delete(key);
          req.onsuccess = () => resolve();
          req.onerror   = () => { throw req.error; };
        });
        this._notifyChange(key, null, oldValue);
        return Result.Ok(true);
      } catch (e) {
        return Result.Err(e);
      }
    }

    async multiRemove(keys) {
      try {
        await this._withTransaction('readwrite', (store, resolve) => {
          let remaining = keys.length;
          if (remaining === 0) { resolve(); return; }
          keys.forEach(key => {
            const req = store.delete(key);
            req.onsuccess = () => { if (--remaining === 0) resolve(); };
            req.onerror   = () => { throw req.error; };
          });
        });
        keys.forEach(key => this._notifyChange(key, null, null));
        return Result.Ok(true);
      } catch (e) {
        return Result.Err(e);
      }
    }

    /**
     * [FIX BUG-09] Use the 'expires' index to efficiently sweep expired entries
     * rather than opening a full cursor and nesting store.get() inside it.
     * Prefix filtering is done in a single pass over a value cursor.
     */
    async keys(prefix = '') {
      try {
        const now  = Date.now();
        const keys = [];

        await this._withTransaction('readwrite', (store, resolve) => {
          // 1. Delete all expired records via the expires index (efficient).
          const expiredRange = IDBKeyRange.bound(1, now);
          const expIdx = store.index('expires');
          const delCur = expIdx.openCursor(expiredRange);
          delCur.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              store.delete(cursor.primaryKey);
              cursor.continue();
            } else {
              // 2. Then collect non-expired keys matching prefix.
              const keyCur = store.openKeyCursor();
              keyCur.onsuccess = (e2) => {
                const c = e2.target.result;
                if (c) {
                  if (String(c.key).startsWith(prefix)) keys.push(c.key);
                  c.continue();
                } else {
                  resolve();
                }
              };
            }
          };
        });
        return Result.Ok(keys);
      } catch (e) {
        return Result.Err(e);
      }
    }

    /**
     * [FIX BUG-04] store.getAll() accepts an IDBKeyRange, not a plain array.
     * Fetch each key individually inside one transaction for consistency.
     * [FIX BUG-12] Validate TTL per item, not just in getItem().
     */
    async multiGet(keys) {
      try {
        const result = {};
        const now    = Date.now();

        await this._withTransaction('readonly', (store, resolve) => {
          let remaining = keys.length;
          if (remaining === 0) { resolve(); return; }

          keys.forEach(key => {
            const req = store.get(key);
            req.onsuccess = () => {
              const data = req.result;
              if (!data || (data.expires && now > data.expires)) {
                result[key] = null;
              } else {
                result[key] = data.value;
              }
              if (--remaining === 0) resolve();
            };
            req.onerror = () => {
              result[key] = null;
              if (--remaining === 0) resolve();
            };
          });
        });
        return Result.Ok(result);
      } catch (e) {
        return Result.Err(e);
      }
    }

    async multiSet(entries, ttl = null) {
      try {
        const now = Date.now();
        await this._withTransaction('readwrite', (store, resolve) => {
          const pairs = Object.entries(entries);
          let remaining = pairs.length;
          if (remaining === 0) { resolve(); return; }

          pairs.forEach(([key, value]) => {
            const data = { key, value, expires: ttl ? now + ttl : null, updatedAt: now };
            const req  = store.put(data);
            req.onsuccess = () => { if (--remaining === 0) resolve(); };
            req.onerror   = () => { throw req.error; };
          });
        });
        Object.keys(entries).forEach(key => this._notifyChange(key, entries[key], null));
        return Result.Ok(true);
      } catch (e) {
        return Result.Err(e);
      }
    }

    async clearAll() {
      try {
        await this._withTransaction('readwrite', (store, resolve) => {
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror   = () => { throw req.error; };
        });
        return Result.Ok(undefined);
      } catch (e) {
        return Result.Err(e);
      }
    }

    /**
     * [FIX BUG-05] Wait for actual in-flight transaction Promises (not Symbols).
     */
    async close() {
      try {
        if (this._pending.size > 0) {
          await Promise.allSettled(Array.from(this._pending));
        }
        if (this._dbPromise) {
          const db = await this._dbPromise;
          db.close();
          this._cleanup();
        }
        if (this._bc) {
          this._bc.close();
          this._bc = null;
        }
      } catch (_) {}
      return Result.Ok(undefined);
    }

    subscribe(callback) {
      this._listeners.add(callback);
      return () => this._listeners.delete(callback);
    }

    _notifyChange(key, newValue, oldValue) {
      this._listeners.forEach(cb => {
        try { cb(key, newValue, oldValue); } catch (_) {}
      });
      if (this._bc) {
        try { this._bc.postMessage({ key, newValue, oldValue }); } catch (_) {}
      }
    }

    /** Sweep all expired records using the expires index. */
    async cleanup() {
      try {
        const now = Date.now();
        await this._withTransaction('readwrite', (store, resolve) => {
          const range   = IDBKeyRange.bound(1, now);
          const cursorReq = store.index('expires').openCursor(range);
          cursorReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              store.delete(cursor.primaryKey);
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorReq.onerror = () => { throw cursorReq.error; };
        });
        return Result.Ok(undefined);
      } catch (e) {
        return Result.Err(e);
      }
    }
  }

  // ===========================================================================
  // 3. Node.js File System Adapter
  // ===========================================================================

  /**
   * [FIX BUG-02] The original IIFE used `await` at the top level of a sync
   * function, causing a syntax/runtime error. Node adapter is now initialized
   * lazily via an async _ensureReady() method called before every operation.
   *
   * [FIX BUG-07] Keys were SHA-256 hashed, making prefix lookup impossible.
   * Each file now stores { key, value, expires } so the original key is
   * recoverable and prefix filtering works correctly.
   */
  const nodeFSAdapter = (() => {
    const isNode = typeof process !== 'undefined' && process.versions?.node != null;
    let fs, path, os, crypto;
    let storageDir    = null;
    let initPromise   = null;
    const fileMutexes = new Map();

    async function init() {
      if (!isNode) return false;
      try {
        fs     = require('fs/promises');
        path   = require('path');
        os     = require('os');
        crypto = require('crypto');
        storageDir = path.join(os.tmpdir(), 'sangocast-storage');
        const exists = await fs.stat(storageDir).then(() => true).catch(() => false);
        if (!exists) await fs.mkdir(storageDir, { recursive: true });
        return true;
      } catch (e) {
        console.warn('[SangocastStorage] Node.js FS init failed:', e);
        return false;
      }
    }

    async function ensureReady() {
      if (!initPromise) initPromise = init();
      return initPromise;
    }

    function getSafeFilename(key) {
      // Hash the key to produce a safe filename, but also store the original key in the file.
      return crypto.createHash('sha256').update(key).digest('hex') + '.json';
    }

    function getMutex(key) {
      const name = getSafeFilename(key);
      if (!fileMutexes.has(name)) fileMutexes.set(name, new AsyncMutex());
      return fileMutexes.get(name);
    }

    async function atomicWrite(filePath, data) {
      const tmp = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmp, JSON.stringify(data), 'utf8');
      await fs.rename(tmp, filePath);
    }

    async function readFileParsed(filePath) {
      try {
        const raw    = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.expires && Date.now() > parsed.expires) {
          await fs.unlink(filePath).catch(() => {});
          return null;
        }
        return parsed; // Returns full object: { key, value, expires }
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    }

    return {
      async getItem(key) {
        if (!await ensureReady()) return Result.Err(new Error('FS not available'));
        const mutex   = getMutex(key);
        const release = await mutex.acquire();
        try {
          const filePath = path.join(storageDir, getSafeFilename(key));
          const parsed   = await readFileParsed(filePath);
          return Result.Ok(parsed ? parsed.value : null);
        } catch (e) {
          return Result.Err(e);
        } finally {
          release();
        }
      },

      async setItem(key, value, ttl = null) {
        if (!await ensureReady()) return Result.Err(new Error('FS not available'));
        const mutex   = getMutex(key);
        const release = await mutex.acquire();
        try {
          const filePath = path.join(storageDir, getSafeFilename(key));
          // [FIX BUG-07] Store original key so keys() can recover it.
          const data = { key, value, expires: ttl ? Date.now() + ttl : null, updatedAt: Date.now() };
          await atomicWrite(filePath, data);
          return Result.Ok(true);
        } catch (e) {
          return Result.Err(e);
        } finally {
          release();
        }
      },

      async removeItem(key) {
        if (!await ensureReady()) return Result.Err(new Error('FS not available'));
        const mutex   = getMutex(key);
        const release = await mutex.acquire();
        try {
          const filePath = path.join(storageDir, getSafeFilename(key));
          await fs.unlink(filePath).catch(e => { if (e.code !== 'ENOENT') throw e; });
          return Result.Ok(true);
        } catch (e) {
          return Result.Err(e);
        } finally {
          release();
        }
      },

      async multiRemove(keys) {
        if (!await ensureReady()) return Result.Err(new Error('FS not available'));
        await Promise.all(keys.map(key => this.removeItem(key)));
        return Result.Ok(true);
      },

      /**
       * [FIX BUG-07] Read each file and use the stored `key` field for prefix
       * filtering — hashes are never compared directly.
       */
      async keys(prefix = '') {
        if (!await ensureReady()) return Result.Err(new Error('FS not available'));
        try {
          const files  = await fs.readdir(storageDir);
          const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('.tmp.'));
          const results = await Promise.all(
            jsonFiles.map(f => readFileParsed(path.join(storageDir, f)))
          );
          const keys = results
            .filter(parsed => parsed !== null && String(parsed.key).startsWith(prefix))
            .map(parsed => parsed.key);
          return Result.Ok(keys);
        } catch (e) {
          return Result.Err(e);
        }
      },

      async multiGet(keys) {
        const result = {};
        await Promise.all(keys.map(async key => {
          const res     = await this.getItem(key);
          result[key]   = res.ok ? res.value : null;
        }));
        return Result.Ok(result);
      },

      async multiSet(entries, ttl = null) {
        await Promise.all(Object.entries(entries).map(([k, v]) => this.setItem(k, v, ttl)));
        return Result.Ok(true);
      },

      async clearAll() {
        if (!await ensureReady()) return Result.Err(new Error('FS not available'));
        try {
          const files = await fs.readdir(storageDir);
          await Promise.all(files.map(f => fs.unlink(path.join(storageDir, f)).catch(() => {})));
          return Result.Ok(undefined);
        } catch (e) {
          return Result.Err(e);
        }
      }
      // No subscribe — would require fs.watch which is platform-inconsistent.
    };
  })();

  // ===========================================================================
  // 4. In-Memory Adapter
  // ===========================================================================

  const memoryAdapter = (() => {
    const store       = new Map();
    const expirations = new Map();
    const listeners   = new Set();

    function scheduleExpiry(key, ttl) {
      if (expirations.has(key)) clearTimeout(expirations.get(key));
      if (!ttl) return;
      const id = setTimeout(() => {
        const oldValue = store.get(key) ?? null;
        store.delete(key);
        expirations.delete(key);
        listeners.forEach(cb => { try { cb(key, null, oldValue); } catch (_) {} });
      }, ttl);
      expirations.set(key, id);
    }

    function dropKey(key) {
      const oldValue = store.get(key) ?? null;
      if (expirations.has(key)) { clearTimeout(expirations.get(key)); expirations.delete(key); }
      store.delete(key);
      return oldValue;
    }

    return {
      async getItem(key) {
        return Result.Ok(store.get(key) ?? null);
      },

      async setItem(key, value, ttl = null) {
        const oldValue = store.get(key) ?? null;
        store.set(key, value);
        scheduleExpiry(key, ttl);
        listeners.forEach(cb => { try { cb(key, value, oldValue); } catch (_) {} });
        return Result.Ok(true);
      },

      async removeItem(key) {
        const oldValue = dropKey(key);
        listeners.forEach(cb => { try { cb(key, null, oldValue); } catch (_) {} });
        return Result.Ok(true);
      },

      /**
       * [FIX BUG-10] await each removal so results are deterministic.
       */
      async multiRemove(keys) {
        for (const key of keys) await this.removeItem(key);
        return Result.Ok(true);
      },

      async keys(prefix = '') {
        return Result.Ok(Array.from(store.keys()).filter(k => k.startsWith(prefix)));
      },

      async multiGet(keys) {
        const result = {};
        keys.forEach(key => { result[key] = store.get(key) ?? null; });
        return Result.Ok(result);
      },

      /**
       * [FIX BUG-10] await each setItem so TTL timers are registered in order.
       */
      async multiSet(entries, ttl = null) {
        for (const [key, value] of Object.entries(entries)) {
          await this.setItem(key, value, ttl);
        }
        return Result.Ok(true);
      },

      async clearAll() {
        store.clear();
        expirations.forEach(id => clearTimeout(id));
        expirations.clear();
        return Result.Ok(undefined);
      },

      subscribe(callback) {
        listeners.add(callback);
        return () => listeners.delete(callback);
      }
    };
  })();

  // ===========================================================================
  // 5. Environment Detection
  // ===========================================================================

  async function detectAdapter(options = {}) {
    if (typeof process !== 'undefined' && process.versions?.node != null) {
      return nodeFSAdapter;
    }
    if (typeof window !== 'undefined') {
      if (!options.preferLocalStorage && window.indexedDB) {
        try {
          const probe = new IndexedDBAdapter('__sangocast_probe__', 1, '__probe__');
          await probe.getItem('__test__');
          await probe.close();
          await window.indexedDB.deleteDatabase('__sangocast_probe__');
          return new IndexedDBAdapter(options.dbName, options.dbVersion, options.storeName);
        } catch (_) {}
      }
      if (window.localStorage) return localStorageAdapter;
    }
    return memoryAdapter;
  }

  // ===========================================================================
  // 6. SangocastStorage — Public API
  // ===========================================================================

  class SangocastStorage {
    constructor(options = {}) {
      this.prefix          = options.prefix || 'sangocast_';
      this._adapterPromise = detectAdapter(options);
      this._options        = options;
      // [FIX BUG-08] Track all unsub functions, not just the last one.
      this._unsubscribers  = new Set();
    }

    async _getAdapter() {
      return this._adapterPromise;
    }

    /** Replace the underlying adapter at runtime. */
    setAdapter(adapter) {
      this._unsubscribers.forEach(fn => fn());
      this._unsubscribers.clear();
      this._adapterPromise = Promise.resolve(adapter);
    }

    _pk(key)        { return this.prefix + key; }
    _strip(prefixed){ return prefixed.startsWith(this.prefix) ? prefixed.slice(this.prefix.length) : prefixed; }

    async getItem(key) {
      const adapter = await this._getAdapter();
      return (await adapter.getItem(this._pk(key))).unwrapOr(null);
    }

    async setItem(key, value, ttl = null) {
      if (typeof value !== 'string') value = JSON.stringify(value);
      const adapter = await this._getAdapter();
      return (await adapter.setItem(this._pk(key), value, ttl)).unwrapOr(false);
    }

    async removeItem(key) {
      const adapter = await this._getAdapter();
      return (await adapter.removeItem(this._pk(key))).unwrapOr(false);
    }

    async multiRemove(keys) {
      const adapter = await this._getAdapter();
      return (await adapter.multiRemove(keys.map(k => this._pk(k)))).unwrapOr(false);
    }

    async keys(prefix = '') {
      const adapter = await this._getAdapter();
      const res     = await adapter.keys(this.prefix + prefix);
      return res.ok ? res.value.map(k => this._strip(k)) : [];
    }

    async has(key) {
      return (await this.getItem(key)) !== null;
    }

    async multiGet(keys) {
      const adapter = await this._getAdapter();
      const res     = await adapter.multiGet(keys.map(k => this._pk(k)));
      if (!res.ok) return {};
      const out = {};
      Object.entries(res.value).forEach(([k, v]) => { out[this._strip(k)] = v; });
      return out;
    }

    async multiSet(entries, ttl = null) {
      const prefixed = {};
      Object.entries(entries).forEach(([k, v]) => {
        prefixed[this._pk(k)] = typeof v === 'string' ? v : JSON.stringify(v);
      });
      const adapter = await this._getAdapter();
      return (await adapter.multiSet(prefixed, ttl)).unwrapOr(false);
    }

    async getJSON(key) {
      const raw = await this.getItem(key);
      if (raw === null) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }

    /**
     * [FIX BUG-11] Iterative circular-reference detection using an explicit
     * stack — the recursive approach stack-overflowed on deeply nested objects.
     */
    async setJSON(key, obj, ttl = null) {
      try {
        const seen  = new WeakSet();
        const stack = [obj];
        while (stack.length) {
          const current = stack.pop();
          if (typeof current !== 'object' || current === null) continue;
          if (seen.has(current)) throw new Error('Circular reference detected');
          seen.add(current);
          Object.values(current).forEach(v => stack.push(v));
        }
        return await this.setItem(key, JSON.stringify(obj), ttl);
      } catch {
        return false;
      }
    }

    async multiSetJSON(entries, ttl = null) {
      try {
        const stringified = {};
        Object.entries(entries).forEach(([k, v]) => { stringified[k] = JSON.stringify(v); });
        return await this.multiSet(stringified, ttl);
      } catch {
        return false;
      }
    }

    /** Clears only keys belonging to this instance's prefix. */
    async clearAll() {
      const adapter  = await this._getAdapter();
      const keysRes  = await adapter.keys(this.prefix);
      if (!keysRes.ok) return false;
      await adapter.multiRemove(keysRes.value);
      return true;
    }

    async close() {
      this._unsubscribers.forEach(fn => fn());
      this._unsubscribers.clear();
      const adapter = await this._getAdapter();
      if (adapter.close) return (await adapter.close()).ok;
      return true;
    }

    /**
     * [FIX BUG-08] Each subscribe() call gets its own unsubscriber stored in a
     * Set. Calling subscribe() multiple times no longer leaks previous listeners.
     * Returns a function that removes only that specific subscription.
     */
    subscribe(callback) {
      const wrapped = (key, newVal, oldVal) => {
        if (key.startsWith(this.prefix)) {
          try { callback(this._strip(key), newVal, oldVal); } catch (_) {}
        }
      };

      let unsubAdapter = () => {};
      const pending = this._getAdapter().then(adapter => {
        if (adapter.subscribe) {
          unsubAdapter = adapter.subscribe(wrapped);
          this._unsubscribers.add(unsubFn); // eslint-disable-line no-use-before-define
        }
      });

      const unsubFn = () => {
        unsubAdapter();
        this._unsubscribers.delete(unsubFn);
      };

      // Store so close() can clean up even if caller loses the reference.
      this._unsubscribers.add(unsubFn);
      return unsubFn;
    }

    /** Trigger periodic cleanup on adapters that support it. */
    async cleanup() {
      const adapter = await this._getAdapter();
      if (adapter.cleanup) return (await adapter.cleanup()).ok;
      return true;
    }
  }

  // ===========================================================================
  // 7. Export
  // ===========================================================================
  return SangocastStorage;

}));
