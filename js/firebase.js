/* ============ FIREBASE REALTIME DATABASE (REST) ============ */
/* Вход строго по auth.uid (Firebase Auth аноним). Всё приватное — в users/<uid>,
   публичная витрина (лидерборд) — в leaderboard/<uid>. Никаких паролей-ключей в базе. */
const FB = {
  URL: 'https://pivkozeta-default-rtdb.firebaseio.com/',

  /* RTDB REST понимает авторизацию ТОЛЬКО через ?auth=<ID-токен> (для правил auth!=null/uid). */
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

  /* Режим тех. перерыва: узел maintenance на КОРНЕ базы */
  async getMaintenance() {
    const v = await this.get('maintenance');
    return v === true;
  },
  async setMaintenance(flag) {
    await this.set('maintenance', !!flag);
  },
  async deleteUser(uid) {
    await this.del('users/' + encodeURIComponent(uid));
  },
  async createUser(nick, key, balance = 1000) {
    if (!nick || !key) throw new Error('Нужны ник и ключ');
    await this.set('users/' + encodeURIComponent(nick), {
      key: key, balance: balance,
      gains: 0, games: 0, maxWin: 0, luck: 0, sound: true, hidden: false,
      savedAt: new Date().toISOString(),
    });
  },
  /* добавить баланс юзеру (read-modify-write) */
  async addBalance(nick, amount) {
    if (!nick || !amount || amount <= 0) throw new Error('Нужен ник и положительная сумма');
    const path = 'users/' + encodeURIComponent(nick);
    const cur = (await this.get(path)) || {};
    const newBal = (cur.balance || 0) + amount;
    await this.set(path, Object.assign({}, cur, { balance: newBal, savedAt: new Date().toISOString() }));
    return newBal;
  },

  /* ============ ВХОД ПО UID (вместо пивного слова) ============ */
  /* Возвращает { nick, data } для текущего auth.uid; если записи users/<uid> нет —
     создаёт дефолтную. Приватное хранится в users/<uid>. */
  async loginByUid(uid, newNick) {
    if (!uid) return null;
    const path = 'users/' + encodeURIComponent(uid);
    let data;
    try { data = await this.get(path); } catch (_) { data = null; }

    let created = false;
    if (!data || typeof data !== 'object') {
      data = {
        nick: newNick || 'гость' + uid.slice(0, 4),
        balance: 1000, gains: 0, games: 0, maxWin: 0, luck: 0, sound: true,
        hidden: false, savedAt: new Date().toISOString(),
      };
      await this.set(path, data);
      created = true;
    }
    // продублировать в публичную витрину лидерборда
    await this.upsertLeaderboard(uid, data).catch(() => {});
    return { nick: data.nick, data, isNew: created, uid, key: null };
  },

  /* публичная витрина для лидерборда: leaderboard/<uid> */
  async upsertLeaderboard(uid, userData) {
    const d = userData || {};
    await this.set('leaderboard/' + encodeURIComponent(uid), {
      nick: d.nick || 'гость',
      balance: typeof d.balance === 'number' ? d.balance : 1000,
      maxWin: typeof d.maxWin === 'number' ? d.maxWin : 0,
      games: typeof d.games === 'number' ? d.games : 0,
      hidden: !!d.hidden,
      updatedAt: new Date().toISOString(),
    });
  },

  /* список для лидерборда — читается из открытого узла leaderboard */
  async listLeaderboard() {
    return (await this.get('leaderboard')) || {};
  },
};
window.FB = FB; // экспорт в глобальную область (в т.ч. после eval в бандле)