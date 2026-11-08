/* ============ FIREBASE: initializeApp + Auth (email/password) + Realtime Database ============ */
/* Модульный (ESM) вариант через CDN — работает на GitHub Pages без сборщика.
   Авторизация — по логину(email)+паролю. auth.uid = ключ записи users/<auth.uid>,
   поэтому правила auth.uid == $uid работают и на чтение, и на запись (игры пишут баланс). */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
const db = getDatabase(app);

// --- Firebase Auth (email/password) ---
const auth = getAuth(app);
// Firebase сохраняет сессию в localStorage по умолчанию → автовход при перезагрузке работает сам

// нормализация логина: "boris" -> "boris@pivko.local", полный email остаётся
function toEmail(login) {
  const s = (login || '').trim();
  if (!s) return '';
  return s.includes('@') ? s : s + '@pivko.local';
}

window.FIREBASE = {
  app: app, db: db, auth: auth,

  // текущий авторизованный юзер (может быть null)
  current: function () { return auth.currentUser; },

  // войти по логину+паролю; возвращает { uid, email } или бросает ошибку
  signIn: async function (login, password) {
    const email = toEmail(login);
    if (!email || !password) throw new Error('Введи логин и пароль');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const u = cred.user;
    return { uid: u.uid, email: u.email };
  },

  // вернуть Firebase ID-токен текущего юзера (для REST ?auth=)
  getIdToken: async function () {
    const u = auth.currentUser;
    if (!u) return null;
    try { return await u.getIdToken(); } catch (e) { return null; }
  },

  signOutAuth: async function () {
    try { await signOut(auth); } catch (e) {}
  },

  // подписка на смену состояния авторизации (для автовхода/выхода)
  onAuthChange: function (cb) {
    return onAuthStateChanged(auth, cb);
  },
};