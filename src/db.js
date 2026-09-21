const DB_NAME = 'market-survey-db';
const DB_VERSION = 2;
const STORE = 'surveys';
const SETTINGS_STORE = 'settings';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('syncStatus', 'syncStatus');
        store.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSurvey(survey) {
  const db = await openDatabase();
  const tx = db.transaction(STORE, 'readwrite');
  await requestToPromise(tx.objectStore(STORE).put(survey));
  db.close();
  return survey;
}

export async function getAllSurveys() {
  const db = await openDatabase();
  const tx = db.transaction(STORE, 'readonly');
  const rows = await requestToPromise(tx.objectStore(STORE).getAll());
  db.close();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPendingSurveys() {
  const db = await openDatabase();
  const tx = db.transaction(STORE, 'readonly');
  const rows = await requestToPromise(tx.objectStore(STORE).index('syncStatus').getAll('pending'));
  db.close();
  return rows;
}

export async function markSurveySynced(id, syncedAt = new Date().toISOString()) {
  const db = await openDatabase();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const survey = await requestToPromise(store.get(id));
  if (survey) await requestToPromise(store.put({ ...survey, syncStatus: 'synced', syncedAt }));
  db.close();
}

export async function saveSetting(key, value) {
  const db = await openDatabase();
  const tx = db.transaction(SETTINGS_STORE, 'readwrite');
  await requestToPromise(tx.objectStore(SETTINGS_STORE).put({ key, value }));
  db.close();
}
