import { getPendingSurveys, markSurveySynced } from './db.js';

export const SYNC_URL_KEY = 'marketSurveySyncUrl';
export const DEFAULT_SYNC_URL = 'https://script.google.com/macros/s/AKfycbz8nuV47_YZKHfqUSGmVwNDtJB_BzxnklWBudrUYPRGfszSz1iRMeVBiV4M8qfdGFl0WA/exec';

export async function syncPendingSurveys(onProgress) {
  const endpoint = (localStorage.getItem(SYNC_URL_KEY) || DEFAULT_SYNC_URL).trim();
  if (!endpoint) return { synced: 0, skipped: true, reason: 'missing-url' };
  if (!navigator.onLine) return { synced: 0, skipped: true, reason: 'offline' };

  const pending = await getPendingSurveys();
  let synced = 0;
  const errors = [];

  for (const survey of pending) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...survey, photo: survey.photo || '' }),
        redirect: 'follow'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json().catch(() => ({ ok: true }));
      if (result.ok === false) throw new Error(result.error || 'Google Sheets từ chối dữ liệu');
      await markSurveySynced(survey.id);
      synced += 1;
      onProgress?.(survey, synced, pending.length);
    } catch (error) {
      errors.push({ id: survey.id, message: error.message });
    }
  }
  return { synced, total: pending.length, errors };
}

export async function requestBackgroundSync() {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  if (!('sync' in registration)) return false;
  try {
    await registration.sync.register('sync-surveys');
    return true;
  } catch {
    return false;
  }
}
