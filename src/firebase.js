/* ============ FIREBASE REALTIME DATABASE (REST) ============ */
/* Подключение к RTDB через REST API — работает и на GitHub Pages, и локально,
   без Firebase SDK. Всё хранится под ключом users/<никнейм>. */
const FB = {
  URL: 'https://pivkozeta-default-rtdb.firebaseio.com/',

  /* Заголовок App Check (Enforced): токен берём из firebase-init.js, если он есть. */
  async _acHeaders(extra) {
    const h = Object.assign({}, extra);
    try {
      const tok = window.FIREBASE && window.FIREBASE.getToken
        ? await window.FIREBASE.getToken() : null;
      if (tok) h['X-Firebase-AppCheck'] = tok;
    } catch (_) { /* App Check недоступен — шлём без токена */ }
    return h;
  },

  async get(path) {
    const r = await fetch(this.URL + path + '.json', {
      headers: await this._acHeaders(),
    });
    if (!r.ok) throw new Error('DB GET ' + r.status);
    return r.json();
  },
  async set(path, val) {
    const r = await fetch(this.URL + path + '.json', {
      method: 'PUT',
      headers: await this._acHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(val),
    });
    if (!r.ok) throw new Error('DB PUT ' + r.status);
    return r.json();
  },
  async del(path) {
    const r = await fetch(this.URL + path + '.json', {
      method: 'DELETE',
      headers: await this._acHeaders(),
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

  /* Вход по «пивному кодовому слову»: ищем в users нick с таким key.
     Возвращает { nick, data } или null, если слова нет. */
  async login(key) {
    const users = (await this.get('users')) || {};
    for (const nick in users) {
      if (users[nick] && users[nick].key === key) {
        return { nick, data: users[nick] };
      }
    }
    return null;
  },
};
window.FB = FB; // экспорт в глобальную область (в т.ч. после eval в бандле)