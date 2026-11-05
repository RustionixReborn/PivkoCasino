/* ============ FIREBASE REALTIME DATABASE (REST) ============ */
/* Подключение к RTDB через REST API — работает и на GitHub Pages, и локально,
   без Firebase SDK. Всё хранится под ключом users/<никнейм>. */
const FB = {
  URL: 'https://pivkokazino-default-rtdb.firebaseio.com/',
  SECRET: 'OmWZ1pJUv2r5jeLNKD6GdarL8N2fbHlRPDbDKDDj',

  async get(path) {
    const r = await fetch(this.URL + path + '.json?auth=' + this.SECRET);
    if (!r.ok) throw new Error('DB GET ' + r.status);
    return r.json();
  },
  async set(path, val) {
    const r = await fetch(this.URL + path + '.json?auth=' + this.SECRET, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(val),
    });
    if (!r.ok) throw new Error('DB PUT ' + r.status);
    return r.json();
  },
  async del(path) {
    const r = await fetch(this.URL + path + '.json?auth=' + this.SECRET, { method: 'DELETE' });
    if (!r.ok) throw new Error('DB DELETE ' + r.status);
  },
  async listUsers() {
    return (await this.get('users')) || {};
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