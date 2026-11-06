/* ============ FIREBASE: initializeApp + App Check (ReCaptchaEnterprise) + Database ============ */
/* Модульный (ESM) вариант через CDN-импорты — работает на GitHub Pages без сборщика.
   Инициализирует приложение, App Check (Enforced) и Realtime Database.
   Экспонирует window.FIREBASE.getToken() — токен подставляется в REST-запросы к RTDB
   (см. firebase.js), чтоб App Check не резал обращения. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: 'AIzaSyCf7f9-a0T-4xtBbrXYvnAIAJjiAL--nTI',
  authDomain: 'pivkokazino.firebaseapp.com',
  databaseURL: 'https://pivkokazino-default-rtdb.firebaseio.com',
  projectId: 'pivkokazino',
  storageBucket: 'pivkokazino.firebasestorage.app',
  messagingSenderId: '511019585836',
  appId: '1:511019585836:web:062b16416d97e57c74dc89',
  measurementId: 'G-G43GM1HEZZ',
};

const app = initializeApp(firebaseConfig);

// --- App Check (Enforced): ReCaptcha Enterprise провайдер ---
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('6Ld4UhMuAAAAAP1xSrQDgQzVJ7FKeEnj2aV88wPV'),
  isTokenAutoRefreshEnabled: true
});
console.log('App Check initialized (ReCaptchaEnterprise)');

// --- Realtime Database ---
const db = getDatabase(app);

// --- кэш токена: не дёргаем рекапчу на каждый запрос к базе ---
let cached = null, cachedAt = 0, fetching = null;
const TTL = 30 * 60 * 1000; // 30 минут
async function getToken() {
  if (cached && Date.now() - cachedAt < TTL) return cached; // свежий
  if (fetching) return fetching; // уже получаем
  fetching = (async () => {
    try {
      const res = await appCheck.getToken();
      cached = (res && res.token) ? res.token : cached;
      cachedAt = Date.now();
      return cached;
    } catch (e) {
      return cached || null; // не смогли — вернём старый (если есть)
    } finally {
      fetching = null;
    }
  })();
  return fetching;
}

window.FIREBASE = { app: app, appCheck: appCheck, db: db, getToken: getToken };