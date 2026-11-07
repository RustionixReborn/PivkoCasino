/* ============ FIREBASE: initializeApp + Auth + Realtime Database ============ */
/* Модульный (ESM) вариант через CDN — работает на GitHub Pages без сборщика.
   App Check намеренно убран: на новом проекте pivkozeta провайдер не настроен,
   и ReCaptchaEnterprise падал, ломая инициализацию. Защита держится на Firebase
   Auth + правилах RTDB (auth != null / владельцы по authUid). */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
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

// --- Realtime Database ---
const db = getDatabase(app);

// --- Firebase Auth (анонимная сессия): даёт auth.uid для правил безопасности ---
const auth = getAuth(app);

// повторяем анонимный вход, пока не получим currentUser (или не исчерпаем попытки)
async function ensureAnonymous() {
  if (auth.currentUser) return auth.currentUser;
  for (let i = 0; i < 4; i++) {
    try {
      const cred = await signInAnonymously(auth);
      if (cred && cred.user) return cred.user;
    } catch (e) {
      console.warn('Anonymous attempt ' + (i + 1) + ' failed:', e.code || e.message);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}
// стартуем сразу, не блокируя инициализацию
ensureAnonymous().then(u => {
  console.log(u
    ? 'Anonymous auth OK, uid=' + u.uid
    : '!!! Anonymous auth FAILED — правила auth!=null будут резать все запросы (проверь, что Anonymous включён в Authentication).');
});

window.FIREBASE = { app: app, db: db, auth: auth,
  // дождаться анонимной авторизации и вернуть готовую auth-сессию
  ensureAuth: async function () {
    if (auth.currentUser) return auth.currentUser;
    const u = await ensureAnonymous();
    // небольшая дождалка на случай гонки
    const deadline = Date.now() + 8000;
    while (!auth.currentUser && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50));
    }
    return auth.currentUser || u || null;
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
  // войти как админ по email+паролю
  signInAdmin: async function (email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred && cred.user ? cred.user : null;
    } catch (e) {
      console.warn('Admin sign-in failed:', e.code || e.message);
      return null;
    }
  },
  signOutAuth: async function () {
    try { await signOut(auth); } catch (e) {}
  }
};