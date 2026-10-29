import { CONFIG } from './config.js';

const DB_NAME = 'MinimalAuthDB';
const DB_VERSION = 1;
const STORE_NAME = 'users';

// Web Crypto API helper for client-side password hashing
async function hashPassword(password, salt = crypto.randomUUID()) {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash: hashHex, salt };
}

// Open IndexedDB instance
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('email', 'email', { unique: true });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const DatabaseService = {
  // Public method: Register a new user
  async registerUser({ name, email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Cloud Provider (Supabase) if enabled
    if (CONFIG.DATABASE_PROVIDER === 'supabase' && CONFIG.SUPABASE.URL && CONFIG.SUPABASE.ANON_KEY) {
      const res = await fetch(`${CONFIG.SUPABASE.URL}/rest/v1/signups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE.ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          name: name.trim(),
          email: normalizedEmail
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409 || (err.message && err.message.includes('duplicate'))) {
          throw new Error('An account with this email already exists.');
        }
        throw new Error(err.message || 'Failed to submit signup.');
      }

      const [newUser] = await res.json();
      return {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        created_at: newUser.created_at,
        provider: 'Cloud Database (Supabase)'
      };
    }

    // 2. Default: Native IndexedDB
    const db = await openIndexedDB();

    return new Promise(async (resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const emailIndex = store.index('email');

      const checkReq = emailIndex.get(normalizedEmail);

      checkReq.onsuccess = async () => {
        if (checkReq.result) {
          return reject(new Error('An account with this email already exists.'));
        }

        const { hash, salt } = await hashPassword(password);
        const userRecord = {
          name: name.trim(),
          email: normalizedEmail,
          password_hash: hash,
          salt: salt,
          created_at: new Date().toISOString()
        };

        const addReq = store.add(userRecord);

        addReq.onsuccess = () => {
          resolve({
            id: addReq.result,
            name: userRecord.name,
            email: userRecord.email,
            created_at: userRecord.created_at,
            provider: 'Local Storage (IndexedDB)'
          });
        };

        addReq.onerror = () => reject(addReq.error);
      };

      checkReq.onerror = () => reject(checkReq.error);
    });
  },

  // Admin-only: Retrieve all users
  async getUsers() {
    if (CONFIG.DATABASE_PROVIDER === 'supabase' && CONFIG.SUPABASE.URL && CONFIG.SUPABASE.ANON_KEY) {
      const res = await fetch(`${CONFIG.SUPABASE.URL}/rest/v1/signups?select=id,name,email,created_at&order=id.desc`, {
        headers: {
          'apikey': CONFIG.SUPABASE.ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`
        }
      });
      if (!res.ok) return [];
      return await res.json();
    }

    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const users = (request.result || []).map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          created_at: u.created_at
        })).reverse();
        resolve(users);
      };

      request.onerror = () => resolve([]);
    });
  },

  // Admin-only: Delete a single user by ID
  async deleteUser(id) {
    if (CONFIG.DATABASE_PROVIDER === 'supabase' && CONFIG.SUPABASE.URL && CONFIG.SUPABASE.ANON_KEY) {
      await fetch(`${CONFIG.SUPABASE.URL}/rest/v1/signups?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': CONFIG.SUPABASE.ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`
        }
      });
      return;
    }

    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(Number(id));
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // Admin-only: Clear all records
  async clearAll() {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
