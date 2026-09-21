import './styles.css';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { getAllSurveys, saveSetting, saveSurvey } from './db.js';
import { DEFAULT_SYNC_URL, requestBackgroundSync, SYNC_URL_KEY, syncPendingSurveys } from './sync.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#surveyForm');
const platform = Capacitor.getPlatform();
let currentLocation = null;
let currentPhoto = '';
let syncRunning = false;
let toastTimer;

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3300);
}

function createId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

async function refreshRecords() {
  const surveys = await getAllSurveys();
  const pending = surveys.filter((item) => item.syncStatus === 'pending').length;
  $('#totalCount').textContent = surveys.length;
  $('#pendingCount').textContent = pending;
  $('#syncedCount').textContent = surveys.length - pending;
  $('#emptyState').classList.toggle('visible', surveys.length === 0);
  $('#recordList').replaceChildren(...surveys.map(createRecordCard));
}

function createRecordCard(survey) {
  const article = document.createElement('article');
  article.className = 'record-card';
  const top = document.createElement('div');
  top.className = 'record-top';
  const details = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = survey.respondentName;
  const subtitle = document.createElement('p');
  subtitle.textContent = `${survey.product} · Quan tâm ${survey.interestLevel}/5`;
  const meta = document.createElement('p');
  meta.textContent = `${formatDate(survey.createdAt)}${survey.location ? ` · ${survey.location.latitude.toFixed(5)}, ${survey.location.longitude.toFixed(5)}` : ''}`;
  const state = document.createElement('span');
  state.className = `sync-state ${survey.syncStatus === 'synced' ? 'synced' : ''}`;
  state.textContent = survey.syncStatus === 'synced' ? 'Đã đồng bộ' : 'Đang chờ';
  details.append(title, subtitle, meta);
  top.append(details, state);
  article.append(top);
  return article;
}

function resetCapture() {
  currentLocation = null;
  currentPhoto = '';
  $('#locationText').textContent = 'Chưa lấy vị trí';
  $('#photoText').textContent = 'Chưa có ảnh';
  $('#photoPreview').hidden = true;
  $('#photoPreview').removeAttribute('src');
  $('#photoInput').value = '';
}

function resetForm() {
  form.reset();
  $('#noteCount').textContent = '0';
  resetCapture();
}

async function getLocation() {
  const button = $('#locationButton');
  button.disabled = true;
  button.textContent = 'Đang lấy...';
  try {
    let coordinates;
    if (Capacitor.isNativePlatform()) {
      const permission = await Geolocation.requestPermissions();
      if (!['granted', 'limited'].includes(permission.location)) throw new Error('Bạn chưa cấp quyền vị trí');
      coordinates = (await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })).coords;
    } else {
      coordinates = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve(coords), reject, { enableHighAccuracy: true, timeout: 15000 }
      ));
    }
    currentLocation = { latitude: coordinates.latitude, longitude: coordinates.longitude, accuracy: Math.round(coordinates.accuracy) };
    $('#locationText').textContent = `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)} (±${currentLocation.accuracy}m)`;
    showToast('Đã ghi nhận vị trí GPS');
  } catch (error) {
    showToast(error.message || 'Không thể lấy vị trí', true);
  } finally {
    button.disabled = false;
    button.textContent = 'Lấy vị trí';
  }
}

function compressDataUrl(dataUrl, maxSize = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * ratio);
      canvas.height = Math.round(image.height * ratio);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function setPhoto(dataUrl) {
  currentPhoto = await compressDataUrl(dataUrl);
  $('#photoPreview').src = currentPhoto;
  $('#photoPreview').hidden = false;
  $('#photoText').textContent = 'Đã thêm ảnh (đã nén)';
}

async function capturePhoto() {
  try {
    if (Capacitor.isNativePlatform()) {
      const permission = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      if (permission.camera !== 'granted') throw new Error('Bạn chưa cấp quyền camera');
      const photo = await Camera.getPhoto({ quality: 82, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Prompt });
      await setPhoto(photo.dataUrl);
    } else {
      $('#photoInput').click();
    }
  } catch (error) {
    if (!String(error.message).toLowerCase().includes('cancel')) showToast(error.message || 'Không thể lấy ảnh', true);
  }
}

async function notifySync(count) {
  if (!count) return;
  if (Capacitor.isNativePlatform()) {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display === 'granted') {
      await LocalNotifications.schedule({ notifications: [{ id: Date.now() % 2147483647, title: 'Đồng bộ hoàn tất', body: `${count} phiếu đã được gửi lên Google Sheets.`, schedule: { at: new Date(Date.now() + 500) } }] });
    }
  } else if ('Notification' in window) {
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission === 'granted') new Notification('Đồng bộ hoàn tất', { body: `${count} phiếu đã được gửi lên Google Sheets.`, icon: '/icons/icon.svg' });
  }
}

async function runSync({ quiet = false } = {}) {
  if (syncRunning) return;
  syncRunning = true;
  const button = $('#syncButton');
  button.disabled = true;
  button.textContent = 'Đang đồng bộ...';
  try {
    const result = await syncPendingSurveys();
    await refreshRecords();
    if (result.reason === 'missing-url' && !quiet) showToast('Hãy nhập Google Apps Script URL trong Cài đặt', true);
    else if (result.reason === 'offline' && !quiet) showToast('Đang ngoại tuyến — dữ liệu vẫn an toàn trên máy');
    else if (result.synced) {
      showToast(`Đã đồng bộ ${result.synced}/${result.total} phiếu`);
      await notifySync(result.synced);
    } else if (result.errors?.length && !quiet) showToast('Đồng bộ chưa thành công, sẽ tự thử lại', true);
    else if (!quiet) showToast('Không có phiếu nào cần đồng bộ');
  } finally {
    syncRunning = false;
    button.disabled = false;
    button.textContent = 'Đồng bộ ngay';
  }
}

async function updateNetworkStatus(status) {
  const connected = typeof status === 'boolean' ? status : status.connected;
  const badge = $('#networkBadge');
  badge.classList.toggle('online', connected);
  badge.classList.toggle('offline', !connected);
  badge.querySelector('span:last-child').textContent = connected ? 'Trực tuyến' : 'Ngoại tuyến';
  if (connected) await runSync({ quiet: true });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    $('#swText').textContent = 'Không hỗ trợ';
    $('#bgSyncText').textContent = 'Không hỗ trợ';
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    await navigator.serviceWorker.ready;
    $('#swText').textContent = 'Đã kích hoạt';
    $('#bgSyncText').textContent = 'sync' in registration ? 'Có hỗ trợ' : 'Dùng đồng bộ khi mở app';
  } catch (error) {
    $('#swText').textContent = 'Lỗi đăng ký';
    console.error(error);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = $('#saveButton');
  button.disabled = true;
  button.textContent = 'Đang lưu...';
  try {
    const data = Object.fromEntries(new FormData(form));
    await saveSurvey({
      id: createId(),
      ...data,
      location: currentLocation,
      photo: currentPhoto,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
      devicePlatform: platform
    });
    resetForm();
    await refreshRecords();
    showToast('Đã lưu phiếu an toàn trên thiết bị');
    if (navigator.onLine) await runSync({ quiet: true });
    else await requestBackgroundSync();
  } catch (error) {
    showToast(`Không thể lưu phiếu: ${error.message}`, true);
  } finally {
    button.disabled = false;
    button.textContent = 'Lưu phiếu khảo sát';
  }
});

$('.bottom-nav').addEventListener('click', (event) => {
  const button = event.target.closest('.nav-button');
  if (!button) return;
  document.querySelectorAll('.nav-button').forEach((item) => item.classList.toggle('active', item === button));
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === button.dataset.view));
  if (button.dataset.view === 'recordsView') refreshRecords();
  scrollTo({ top: 0, behavior: 'smooth' });
});

$('#locationButton').addEventListener('click', getLocation);
$('#cameraButton').addEventListener('click', capturePhoto);
$('#photoInput').addEventListener('change', async (event) => {
  if (event.target.files[0]) await setPhoto(await fileToDataUrl(event.target.files[0]));
});
$('#resetButton').addEventListener('click', resetForm);
$('#syncButton').addEventListener('click', () => runSync());
$('#notes').addEventListener('input', (event) => { $('#noteCount').textContent = event.target.value.length; });
$('#saveSettingsButton').addEventListener('click', async () => {
  const url = $('#syncUrl').value.trim();
  if (url && !url.startsWith('https://script.google.com/')) {
    showToast('URL phải là Web App của Google Apps Script', true);
    return;
  }
  localStorage.setItem(SYNC_URL_KEY, url);
  await saveSetting('syncUrl', url);
  showToast('Đã lưu cấu hình đồng bộ');
  if (url) await runSync({ quiet: true });
});

async function initialize() {
  const configuredUrl = localStorage.getItem(SYNC_URL_KEY) || DEFAULT_SYNC_URL;
  localStorage.setItem(SYNC_URL_KEY, configuredUrl);
  await saveSetting('syncUrl', configuredUrl);
  $('#syncUrl').value = configuredUrl;
  $('#platformText').textContent = Capacitor.isNativePlatform() ? `Android (${platform})` : 'Web PWA';
  await refreshRecords();
  await registerServiceWorker();
  if (Capacitor.isNativePlatform()) {
    const initial = await Network.getStatus();
    await updateNetworkStatus(initial);
    Network.addListener('networkStatusChange', updateNetworkStatus);
  } else {
    await updateNetworkStatus(navigator.onLine);
    addEventListener('online', () => updateNetworkStatus(true));
    addEventListener('offline', () => updateNetworkStatus(false));
  }
}

initialize().catch((error) => showToast(error.message, true));
