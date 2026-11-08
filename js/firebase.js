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

  /* ============ ВХОД ЧЕРЕЗ FIREBASE AUTH (логин + пароль) ============ */
  /* Входит по логину(email)+паролю через Firebase Auth. Возвращает { nick, data, uid }
     где uid = auth.uid (ключ записи users/<auth.uid>). Если записи ещё нет — создаёт.
     Запись баланса идёт по auth.uid, поэтому правила auth.uid==$uid пропускают её. */
  async login(login, password) {
    if (!login || !password) return null;
    // войти через Firebase Auth — бросает ошибку при неверных данных
    const au = await window.FIREBASE.signIn(login, password);
    return this.loadSession(au.uid, au.email);
  },

  /* Загрузить/создать запись users/<uid> для уже авторизованного юзера (автовход,
     без повторного signIn). Возвращает { nick, data, uid }. */
  async loadSession(uid, email) {
    const path = 'users/' + encodeURIComponent(uid);
    let data = null;
    try { data = await this.get(path); } catch (_) { data = null; }

    let isNew = false;
    if (!data || typeof data !== 'object') {
      data = {
        nick: (email || '').replace(/@pivko\.local$/, '') || 'игрок',
        balance: 1000, gains: 0, games: 0, maxWin: 0, luck: 0, sound: true,
        hidden: false, savedAt: new Date().toISOString(),
      };
      await this.set(path, data);
      isNew = true;
    }
    // продублировать в витрину лидерборда
    await this.upsertLeaderboard(uid, data).catch(() => {});
    return { nick: data.nick, data, uid, isNew: isNew, banned: !!data.banned, banReason: data.banReason || '' };
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

  /* ============ ДРУЗЬЯ ============
     friends/sent/<fromUid>/<toUid>   — исходящие заявки
     friends/requests/<toUid>/<fromUid> — входящие заявки
     friends/list/<uid>/<friendUid>   — принятые друзья            */
  myUid() {
    return (window.FIREBASE && window.FIREBASE.current ? window.FIREBASE.current() : null)?.uid || null;
  },
  // список uid: type = 'out'(сент) | 'in'(requests) | 'list'
  async friendList(type) {
    const me = this.myUid();
    if (!me) return [];
    const key = type === 'out' ? 'sent' : type === 'in' ? 'requests' : 'list';
    const data = await this.get('friends/' + key + '/' + encodeURIComponent(me)).catch(() => null);
    return data ? Object.keys(data) : [];
  },
  async friendSend(toUid) {
    const me = this.myUid();
    if (!me || !toUid) throw new Error('Нет uid');
    const at = new Date().toISOString();
    await this.set('friends/sent/' + encodeURIComponent(me) + '/' + encodeURIComponent(toUid), { at });
    await this.set('friends/requests/' + encodeURIComponent(toUid) + '/' + encodeURIComponent(me), { at });
  },
  async friendCancel(toUid) { // отменить исходящую
    const me = this.myUid();
    await this.del('friends/sent/' + encodeURIComponent(me) + '/' + encodeURIComponent(toUid));
    await this.del('friends/requests/' + encodeURIComponent(toUid) + '/' + encodeURIComponent(me));
  },
  async friendAccept(fromUid) { // принять входящую
    const me = this.myUid();
    const at = new Date().toISOString();
    // 1) взаимная дружба (list writable by any auth)
    await this.set('friends/list/' + encodeURIComponent(me) + '/' + encodeURIComponent(fromUid), { at });
    await this.set('friends/list/' + encodeURIComponent(fromUid) + '/' + encodeURIComponent(me), { at });
    // 2) СВОЮ входящую заявку удаляем (requests/<me>/... — разрешено)
    await this.del('friends/requests/' + encodeURIComponent(me) + '/' + encodeURIComponent(fromUid));
    // 3) чужой sent/<from>/... удалить НЕ можем (владелец — отправитель).
    //    Пробуем, но не роняем процесс: отправитель сам почистит при следующем входе.
    try { await this.del('friends/sent/' + encodeURIComponent(fromUid) + '/' + encodeURIComponent(me)); } catch (_) {}
  },
  async friendDecline(fromUid) { // отклонить входящую
    const me = this.myUid();
    await this.del('friends/sent/' + encodeURIComponent(fromUid) + '/' + encodeURIComponent(me));
    await this.del('friends/requests/' + encodeURIComponent(me) + '/' + encodeURIComponent(fromUid));
  },
  async friendRemove(friendUid) { // удалить из друзей
    const me = this.myUid();
    return Promise.all([
      this.del('friends/list/' + encodeURIComponent(me) + '/' + encodeURIComponent(friendUid)).catch(() => {}),
      this.del('friends/list/' + encodeURIComponent(friendUid) + '/' + encodeURIComponent(me)).catch(() => {}),
    ]);
  },
  // reconcile: если кого-то из «исходящих» я уже добавил в друзья — чищу свою несмешную заявку
  async reconcile() {
    const me = this.myUid();
    if (!me) return;
    try {
      const [sent, list] = await Promise.all([
        this.friendList('out').catch(() => []),
        this.friendList('list').catch(() => []),
      ]);
      for (const u of sent) {
        if (list.includes(u)) await this.del('friends/sent/' + encodeURIComponent(me) + '/' + encodeURIComponent(u)).catch(() => {});
      }
    } catch (_) {}
  },
  // поиск юзеров по нику в открытой витрине leaderboard
  async findByNick(q) {
    const lb = await this.listLeaderboard();
    const s = (q || '').trim().toLowerCase();
    if (!s) return [];
    const out = [];
    for (const uid in lb) {
      const d = lb[uid] || {};
      if (d.nick && String(d.nick).toLowerCase().includes(s)) {
        out.push({ uid, nick: d.nick, bal: d.balance || 0, games: d.games || 0, maxWin: d.maxWin || 0 });
      }
    }
    return out;
  },

  /* ============ БАТТЛ (PvP с другом) ============
     out/<A>/<B>     — A отправил приглашение (A читает/пишет своё)
     inc/<B>/<A>     — входящее к B ({bet})
     rooms/<rid>     — комната: a,b,aBet,bBet,aNick,bNick,state,startAt,seed,result
     Каждый игрок пишет ТОЛЬКО свой баланс: проигравший списывает ставку,
     победитель начисляет себе банк (правила не дают писать в чужой users).  */
  async battleSend(friendUid, bet) {
    const me = this.myUid();
    if (!me || !friendUid || !bet) throw new Error('Нет данных для баттла');
    const ts = new Date().toISOString();
    const inv = { bet: Math.floor(bet), ts };
    await this.set('battles/out/' + encodeURIComponent(me) + '/' + encodeURIComponent(friendUid), inv);
    await this.set('battles/inc/' + encodeURIComponent(friendUid) + '/' + encodeURIComponent(me), inv);
  },
  async battleCancel(friendUid) {
    const me = this.myUid();
    await this.del('battles/out/' + encodeURIComponent(me) + '/' + encodeURIComponent(friendUid));
    await this.del('battles/inc/' + encodeURIComponent(friendUid) + '/' + encodeURIComponent(me));
  },
  async battleIncoming() {
    const me = this.myUid();
    const data = await this.get('battles/inc/' + encodeURIComponent(me)).catch(() => null);
    return data ? Object.keys(data) : [];
  },
  // входящие с деталями (uid + bet отправителя)
  async battleIncomingDetail() {
    const me = this.myUid();
    const data = await this.get('battles/inc/' + encodeURIComponent(me)).catch(() => null);
    if (!data) return [];
    return Object.keys(data).map(uid => ({ uid, bet: (data[uid] && data[uid].bet) || 0 }));
  },
  // комнаты, где я участник (acc/<me> = { rid: 1 })
  async battleAcc() {
    const me = this.myUid();
    const data = await this.get('battles/acc/' + encodeURIComponent(me)).catch(() => null);
    return data ? Object.keys(data) : [];
  },
  async battleOutgoing() {
    const me = this.myUid();
    const data = await this.get('battles/out/' + encodeURIComponent(me)).catch(() => null);
    return data ? Object.keys(data) : [];
  },
  async battleDecline(fromUid) {
    const me = this.myUid();
    await this.del('battles/out/' + encodeURIComponent(fromUid) + '/' + encodeURIComponent(me));
    await this.del('battles/inc/' + encodeURIComponent(me) + '/' + encodeURIComponent(fromUid));
  },
  // B принимает: создаёт комнату
  async battleAccept(fromUid, myBet) {
    const me = this.myUid();
    const inv = await this.get('battles/inc/' + encodeURIComponent(me) + '/' + encodeURIComponent(fromUid)).catch(() => null);
    if (!inv || !inv.bet) throw new Error('Приглашение не найдено');
    const rid = encodeURIComponent(me) + '_' + encodeURIComponent(fromUid) + '_' + Date.now().toString(36);
    const seed = Math.floor(Math.random() * 1e9);
    // случайные цвета (синий/красный), у каждого свой
    const flip = Math.random() < 0.5;
    const aColor = flip ? '#3d8bff' : '#ff4d5e';   // A
    const bColor = flip ? '#ff4d5e' : '#3d8bff';   // B
    const room = {
      a: fromUid, b: me,
      aBet: Math.floor(inv.bet), bBet: Math.floor(myBet),
      aNick: '', bNick: '',
      aColor: aColor, bColor: bColor,
      state: 'countdown', startAt: Date.now(), seed: seed,
      result: null,
    };
    // подставить ники
    try { const la = await this.get('leaderboard/' + encodeURIComponent(fromUid)); room.aNick = (la && la.nick) || fromUid.slice(0,6); } catch (_) {}
    try { const lb2 = await this.get('leaderboard/' + encodeURIComponent(me)); room.bNick = (lb2 && lb2.nick) || me.slice(0,6); } catch (_) {}
    await this.set('battles/rooms/' + rid, room);
    // реестр моих комнат (для восстановления после перезагрузки)
    await this.set('battles/acc/' + encodeURIComponent(me) + '/' + rid, { r: 1 });
    await this.set('battles/acc/' + encodeURIComponent(fromUid) + '/' + rid, { r: 1 });
    // чистим СВОЮ входящую заявку (свой узел — можно).
    // Чужой out/<fromUid>/<me> удалить физически нельзя (пишет только отправитель) —
    // отправитель сам снимет свой вызов при входе в комнату (battleClearOwnOut).
    await this.del('battles/inc/' + encodeURIComponent(me) + '/' + encodeURIComponent(fromUid));
    return rid;
  },
  // отправитель (room.a) снимает СВОЙ исходящий вызов после того, как соперник принял/комната завершилась
  async battleClearOwnOut(rid) {
    const me = this.myUid();
    if (!me) return;
    try {
      const room = await this.battleGetRoom(rid);
      if (!room) return;
      if (room.a === me) {
        await this.del('battles/out/' + encodeURIComponent(me) + '/' + encodeURIComponent(room.b)).catch(() => {});
      }
    } catch (_) {}
  },
  async battleGetRoom(rid) {
    return await this.get('battles/rooms/' + rid).catch(() => null);
  },
  // детерминированная рулетка: победитель вычисляется одинаково на обеих машинах
  async battleResolve(rid) {
    const room = await this.battleGetRoom(rid);
    if (!room || room.state === 'done') return room;
    // seeded PRNG (mulberry32) от seed+rid — чтобы оба клиента получили один результат
    let h = 2166136261 >>> 0;
    const s = (String(room.seed) + ':' + rid);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    let a = h >>> 0;
    function rand() { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    const total = room.aBet + room.bBet;
    // макс 10 клеток: пропорция ставок → сколько клеток у каждого (мин. 1 каждому)
    let aCells = Math.max(1, Math.min(9, Math.round(10 * room.aBet / total)));
    let bCells = 10 - aCells;
    // взвешенный победитель
    const r = rand() * total;
    const winner = r < room.aBet ? room.a : room.b; // взвешенно по ставке
    // клетка рулетки согласована с победителем: если A — внутри его диапазона [0,aCells)
    const winCell = winner === room.a
      ? Math.floor(rand() * aCells)
      : aCells + Math.floor(rand() * bCells);
    room.state = 'done';
    room.result = { winner, loser: winner === room.a ? room.b : room.a, aBet: room.aBet, bBet: room.bBet, aCells, bCells, winCell };
    await this.set('battles/rooms/' + rid, room);
    return room;
  },
  // после 'done': применить деньги на СВОЮ сторону (идемпотентно, ОДИН раз при финале)
  // Списание при входе НЕ делаем: ставка уходит здесь — проигравший минус, победитель +банк.
  async battleSettle(rid) {
    const me = this.myUid();
    const room = await this.battleGetRoom(rid);
    if (!room || room.state !== 'done' || !room.result) return null;
    const r = room.result;
    const bank = room.aBet + room.bBet;
    const myBet = me === room.a ? room.aBet : room.bBet;
    // локально закрываем вкладку: если платёж уже сделан — не повторяем
    let paid = false;
    try { paid = JSON.parse(localStorage.getItem('battle_paid_' + rid) || 'false'); } catch (_) {}
    if (paid) return null;
    const cur = await this.get('users/' + encodeURIComponent(me)).catch(() => ({})) || {};
    if (r.winner === me) {
      cur.balance = (cur.balance || 0) + bank; // забрал банк (свою ставку вернул + выигрыш)
    } else {
      cur.balance = Math.max(0, (cur.balance || 0) - myBet); // потерял ставку
    }
    cur.savedAt = new Date().toISOString();
    await this.set('users/' + encodeURIComponent(me), cur);
    await this.upsertLeaderboard(me, cur).catch(() => {});
    try { localStorage.setItem('battle_paid_' + rid, 'true'); } catch (_) {}
    return r.winner === me ? bank : -myBet;
  },
  // чистка: убрать комнату из моего реестра acc (+ саму комнату, если я последний ушёл)
  async battleClean(rid) {
    const me = this.myUid();
    try { await this.del('battles/acc/' + encodeURIComponent(me) + '/' + rid); } catch (_) {}
    // комнату удалить может любой (rooms writable by auth) — чистим её, если расчёт закрыт у обоих
    try {
      const room = await this.battleGetRoom(rid);
      if (!room) return;
      const accA = await this.get('battles/acc/' + encodeURIComponent(room.a) + '/' + rid).catch(() => null);
      const accB = await this.get('battles/acc/' + encodeURIComponent(room.b) + '/' + rid).catch(() => null);
      if (!accA && !accB) await this.del('battles/rooms/' + rid).catch(() => {});
    } catch (_) {}
  },
};
window.FB = FB; // экспорт в глобальную область (в т.ч. после eval в бандле)
