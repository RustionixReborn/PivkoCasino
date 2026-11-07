/* ============ FIREBASE: initializeApp + App Check (ReCaptchaEnterprise) + Database ============ */
/* Модульный (ESM) вариант через CDN-импорты — работает на GitHub Pages без сборщика.
   Инициализирует приложение, App Check (Enforced) и Realtime Database.
   Экспонирует window.FIREBASE.getToken() — токен подставляется в REST-запросы к RTDB
   (см. firebase.js), чтоб App Check не резал обращения. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: 'AIzaSyBlCJlOQ7YPaKWWAA7HUJOueMS7Q_0M7cQ',
  authDomain: 'pivkozeta.firebaseapp.com',
  databaseURL: 'https://pivkozeta-default-rtdb.firebaseio.com',
  projectId: 'pivkozeta',
  storageBucket: 'pivkozeta.firebasestorage.app',
  messagingSenderId: '769892443386',
  appId: '1:769892443386:web:ed284ef988649556d31543',
};

const app = initializeApp(firebaseConfig);

// --- App Check (Enforced): ReCaptcha Enterprise провайдер ---
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('6Ld4UhMuAAAAAPixSrQDgQzVJ7FKeEnj2aV88wPV'),
  isTokenAutoRefreshEnabled: true
});
console.log('App Check initialized (ReCaptchaEnterprise)');

// --- Realtime Database ---
const db = getDatabase(app);

// --- Firebase Auth (анонимная сессия): даёт auth.uid для правил безопасности ---
const auth = getAuth(app);
// анонимный вход при старте, чтобы у каждого посетителя был uid
signInAnonymously(auth).catch(e => console.warn('Anonymous auth failed:', e));

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

window.FIREBASE = { app: app, appCheck: appCheck, db: db, auth: auth, getToken: getToken,
  // дождаться анонимной авторизации и вернуть готовую auth-сессию
  ensureAuth: async function () {
    // уже залогинен — вернуть
    if (auth.currentUser) return auth.currentUser;
    // иначе ждём анонимный вход (signInAnonymously уже запущен выше)
    const deadline = Date.now() + 8000;
    while (!auth.currentUser && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50));
    }
    return auth.currentUser || null;
  },
  // вернуть Firebase ID-токен текущего юзера (для REST ?auth=)
  getIdToken: async function () {
    const u = await this.ensureAuth();
    if (!u) return null;
    try { return await u.getIdToken(); } catch (e) { return null; }
  },
  // является ли текущая сессия админ-аккаунтом (по email)
  isAdmin: async function () {
    const u = await this.ensureAuth();
    return !!(u && u.email && /admin/i.test(u.email));
  },
  // войти как админ по email+паролю (путь А)
  signInAdmin: async function (email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred && cred.user ? cred.user : null;
    } catch (e) {
      console.warn('Admin sign-in failed:', e.code || e.message);
      return null;
    }
  },
  // обратно на аноним (выход из админ-сессии обратно в игрока не нужен — выходим совсем)
  signOutAuth: async function () {
    try { await signOut(auth); } catch (e) {}
  }
};