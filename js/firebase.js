/* ============ FIREBASE REALTIME DATABASE (REST) ============ */
/* Подключение к RTDB через REST API — работает и на GitHub Pages, и локально,
   без Firebase SDK. Всё хранится под ключом users/<никнейм>. */
const FB = {
  URL: 'https://pivkozeta-default-rtdb.firebaseio.com/',

  /* Заголовок App Check (Enforced): токен берём из firebase-init.js, если он есть.
     Важно: firebase-init.js — это <script type="module">, он выполняется ПОЗЖЕ обычных
     скриптов. Поэтому здесь ждём готовности модуля (до ~4 сек), иначе первый запрос
     уйдёт без токена и получит 401 "Missing appcheck token". */
  /* Полный набор заголовков: App Check + (опц.) Firebase ID-токен для auth. */
  /* Заголовки запроса: Firebase auth ID-токен (для правил auth != null).
     App Check убран — на проекте pivkozeta он не настроен. */
  async _headers(extra) {
    const h = Object.assign({}, extra);
    // недолго ждём, пока модуль firebase-init.js инициализировал window.FIREBASE
    const deadline = Date.now() + 4000;
    while (typeof window.FIREBASE === 'undefined' && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50));
    }
    // Firebase auth ID-токен — чтобы правила видели auth != null / auth.uid
    try {
      const idt = window.FIREBASE && window.FIREBASE.getIdToken ? await window.FIREBASE.getIdToken() : null;
      if (idt) h['Authorization'] = 'Bearer ' + idt;
    } catch (_) {}
    return h;
  },

  /* списal вариант для старых вызовов (оставлено для совместимости) */
  async _acHeaders(extra) {
    return this._headers(extra);
  },

  async get(path) {
    const r = await fetch(this.URL + path + '.json', { headers: await this._headers() });
    if (!r.ok) throw new Error('DB GET ' + r.status);
    return r.json();
  },
  async set(path, val) {
    const r = await fetch(this.URL + path + '.json', {
      method: 'PUT',
      headers: await this._headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(val),
    });
    if (!r.ok) throw new Error('DB PUT ' + r.status);
    return r.json();
  },
  async del(path) {
    const r = await fetch(this.URL + path + '.json', {
      method: 'DELETE',
      headers: await this._headers(),
    });
    if (!r.ok) throw new Error('DB DELETE ' + r.status);
  },
  async listUsers() {
    return (await this.get('users')) || {};
  },

  /* Режим тех. перерыва: узел maintenance на КОРНЕ базы, рядом с users */
  async getMaintenance() {
    const v = await this.get('maintenance');
    return v === true;
  },
  async setMaintenance(flag) {
    await this.set('maintenance', !!flag);
  },
  async createUser(nick, key, balance = 1000) {
    if (!nick || !key) throw new Error('Нужны ник и ключ');
    await this.set('users/' + encodeURIComponent(nick), {
      key: key,
      balance: balance,
      gains: 0, games: 0, maxWin: 0, luck: 0, sound: true, hidden: false,
      savedAt: new Date().toISOString(),
    });
  },
  async deleteUser(nick) {
    await this.del('users/' + encodeURIComponent(nick));
  },
  /* добавить баланс юзеру (read-modify-write — прибавляет к текущему значению) */
  async addBalance(nick, amount) {
    if (!nick || !amount || amount <= 0) throw new Error('Нужен ник и положительная сумма');
    const path = 'users/' + encodeURIComponent(nick);
    const cur = (await this.get(path)) || {};
    const newBal = (cur.balance || 0) + amount;
    await this.set(path, Object.assign({}, cur, { balance: newBal, savedAt: new Date().toISOString() }));
    return newBal;
  },

  /* Вход по «пивному кодовому слову»: ищем в users ник с таким key.
     При успехе привязываем authUid = текущий анонимный uid (для правил).
     Возвращает { nick, data } или null. */
  async login(key) {
    const users = (await this.get('users')) || {};
    for (const nick in users) {
      if (users[nick] && users[nick].key === key) {
        // привязать authUid, если есть анонимная сессия
        try {
          const uid = await (window.FIREBASE.ensureAuth().then(u => u ? u.uid : null));
          if (uid && users[nick].authUid !== uid) {
            await this.set('users/' + encodeURIComponent(nick) + '/authUid', uid);
            users[nick].authUid = uid;
          }
        } catch (_) {}
        return { nick, data: users[nick] };
      }
    }
    return null;
  },
};
window.FB = FB; // экспорт в глобальную область (в т.ч. после eval в бандле)