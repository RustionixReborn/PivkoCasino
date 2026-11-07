/* ============ FIREBASE REALTIME DATABASE (REST) ============ */
/* Подключение к RTDB через REST API — работает и на GitHub Pages, и локально,
   без Firebase SDK. Всё хранится под ключом users/<никнейм>. */
const FB = {
  URL: 'https://pivkozeta-default-rtdb.firebaseio.com/',

  /* Realtime Database REST понимает авторизацию ТОЛЬКО через параметр ?auth=<токен>.
     Здесь ?auth= заполняется Firebase ID-токеном (для правил auth != null / auth.uid). */
  _waitFb() {
    return new Promise((resolve) => {
      const deadline = Date.now() + 5000;
      (function tick() {
        if (typeof window.FIREBASE !== 'undefined') return resolve(true);
        if (Date.now() > deadline) return resolve(false);
        setTimeout(tick, 50);
      })();
    });
  },
  async _authToken() {
    try {
      if (typeof window.FIREBASE === 'undefined') { await this._waitFb(); }
      if (window.FIREBASE && window.FIREBASE.getIdToken) {
        return await window.FIREBASE.getIdToken();
      }
    } catch (_) {}
    return null;
  },
  async _url(path) {
    const tok = await this._authToken();
    return this.URL + path + '.json' + (tok ? '?auth=' + encodeURIComponent(tok) : '');
  },

  async get(path) {
    const r = await fetch(await this._url(path));
    if (!r.ok) throw new Error('DB GET ' + r.status);
    return r.json();
  },
  async set(path, val) {
    const r = await fetch(await this._url(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(val),
    });
    if (!r.ok) throw new Error('DB PUT ' + r.status);
    return r.json();
  },
  async del(path) {
    const r = await fetch(await this._url(path), { method: 'DELETE' });
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
