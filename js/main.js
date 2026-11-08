/* ============ PIVKOTAVERN — ОСНОВНОЙ СЦЕНАРИЙ ============ */
(() => {
  const games = Object.values(PC.games); // только 5 оставшихся
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  /* ---------- сетка карточек ---------- */
  const grid = document.getElementById('gamesGrid');
  function renderCards() {
    grid.innerHTML = '';
    games.forEach((g, idx) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.animationDelay = (idx * 0.06) + 's';
      card.innerHTML = `
        <span class="card-tag">${g.tag}</span>
        <span class="card-emoji">${g.emoji}</span>
        <h3>${g.name}</h3>
        <p>${g.desc}</p>
        <div class="card-foot">
          <span class="card-wager">${g.free ? '🎁 Бесплатно' : '💸 мин. ' + PC.fmt(g.minBet)}</span>
          <span class="card-pay">${g.free ? '💰 до +10 ₽' : 'Pot: до ×' + g.maxMult}</span>
        </div>
      `;
      card.onclick = () => openGame(g);
      grid.appendChild(card);
    });
  }

  /* ---------- модалка ---------- */
  const overlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalGame = document.getElementById('modalGame');
  let currentGame = null;

  function openGame(g) {
    if (!PC.loggedIn) { PC.toast('🔒 Сначала введи пивное кодовое слово!', 'bad'); return; }
    currentGame = g;
    modalTitle.textContent = g.emoji + ' ' + g.name;
    modalGame.innerHTML = '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (g.id === 'battle') {
      // Баттл: сразу лобби, без экрана ставки (деньги решаются при входе в комнату)
      PC.mainAction = null;
      g.start(modalGame, 0, () => { showBetScreen(g); });
      return;
    }
    showBetScreen(g);
  }
  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('modalClose').onclick = closeModal;

  /* ---------- ЭКРАН СТАВКИ ---------- */
  function showBetScreen(g) {
    PC.mainAction = null;
    const s = document.createElement('div');
    s.className = 'bet-screen';
    modalGame.innerHTML = '';
    modalGame.appendChild(s);

    if (g.free) {
      s.innerHTML = `
        <span class="bet-icon">${g.emoji}</span>
        <div class="bet-name">${g.name}</div>
        <div class="bet-desc">${g.desc}</div>
        <div class="bet-info">🎁 Бесплатная игра — рискни, но осторожно.</div>
        <button class="btn btn-primary bet-cta" id="betPlay">🍻 Играть (бесплатно)</button>
      `;
      s.querySelector('#betPlay').onclick = () => startGame(g, 0);
      return;
    }

    let bet = g.minBet;
    s.innerHTML = `
      <span class="bet-icon">${g.emoji}</span>
      <div class="bet-name">${g.name}</div>
      <div class="bet-desc">${g.desc}</div>
      <div class="bet-amounts" id="betAmounts"></div>
      <div class="bet-custom">
        <label class="hint" style="margin:0" for="betCustom">или своя ставка (₽)</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="number" id="betCustom" class="bet-input" min="1" placeholder="свой размер" style="flex:1">
          <button class="btn btn-primary bet-va" id="betVaBank" title="Поставить весь баланс">🔥 ВА-БАНК!</button>
        </div>
      </div>
      <div class="bet-info">Минимальная ставка: <b>${PC.fmt(g.minBet)}</b>. У тебя на руках: <b id="balNow"></b></div>
      <button class="btn btn-primary bet-cta" id="betPlay">▶ Играть на <span id="betSel">${PC.fmt(bet)}</span></button>
    `;
    const am = s.querySelector('#betAmounts');
    const balNow = s.querySelector('#balNow');
    const customInput = s.querySelector('#betCustom');
    const refresh = () => balNow.textContent = PC.fmt(PC.state.balance);
    refresh();
    // обновлять баланс, если он изменился
    const iv = setInterval(refresh, 800);

    g.bets.forEach(b => {
      const o = document.createElement('button');
      o.className = 'bet-option' + (b === bet ? ' active' : '');
      o.innerHTML = `${PC.fmt(b)}<span class="bet-tag">${b === g.minBet ? 'мин' : ''}</span>`;
      o.onclick = () => {
        PC.click();
        am.querySelectorAll('.bet-option').forEach(x => x.classList.remove('active'));
        o.classList.add('active');
        bet = b;
        customInput.value = '';
        s.querySelector('#betSel').textContent = PC.fmt(bet);
      };
      am.appendChild(o);
    });
    // кастомная ставка
    customInput.addEventListener('input', () => {
      const v = parseInt(customInput.value, 10);
      if (v && v > 0) {
        bet = v;
        am.querySelectorAll('.bet-option').forEach(x => x.classList.remove('active'));
        s.querySelector('#betSel').textContent = PC.fmt(v);
      }
    });
    s.querySelector('#betPlay').onclick = () => {
      clearInterval(iv);
      let final = bet;
      const cv = parseInt(customInput.value, 10);
      if (cv && cv > 0) final = cv;
      startGame(g, final);
    };

    // 🔥 ВА-БАНК — поставить весь баланс
    s.querySelector('#betVaBank').onclick = () => {
      PC.click();
      const whole = PC.state.balance;
      if (whole < g.minBet) { PC.toast(`Не хватает даже на минимум (${PC.fmt(g.minBet)}). Возьми стартовое пиво!`, 'bad'); return; }
      bet = whole;
      customInput.value = whole;
      am.querySelectorAll('.bet-option').forEach(x => x.classList.remove('active'));
      s.querySelector('#betSel').textContent = PC.fmt(whole);
    };
  }

  /* ---------- СТАРТ ИГРЫ (списание ставки) ---------- */
  function startGame(g, bet) {
    if (!g.free && g.id !== 'battle') {
      // обычные игры: списываем ставку сразу
      if (bet < g.minBet) {
        PC.toast(`Минимальная ставка в «${g.name}» — ${PC.fmt(g.minBet)}. Правила кабака!`, 'bad');
        return;
      }
      if (PC.state.balance < bet) {
        PC.toast('Не хватает рублей! Возьми «стартовое пиво» или вложись скромнее.', 'bad');
        return;
      }
      PC.dec(bet);
    }
    // Баттл: деньги НЕ списываются на старте — это лобби. Ставка берётся только при входе в комнату.
    PC.click();
    modalGame.innerHTML = '';
    g.start(modalGame, bet, () => showBetScreen(g));
  }

  /* ---------- приветствие: стартовое пиво ---------- */
  document.getElementById('welcomeBtn').onclick = () => {
    if (!PC.loggedIn) { PC.toast('🔒 Сначала введи пивное кодовое слово!', 'bad'); return; }
    PC.click();
    // Стартовое пиво 250 ₽, но только если баланс меньше 250 (включая ноль)
    if (PC.state.balance < 250) {
      PC.balance(250);
      PC.confetti();
      PC.toast('🍺 Стартовое пиво: +250 ₽! Бармен уважает за трезвый старт.', 'gold');
    } else {
      PC.toast('🍺 У тебя уже есть чем играть. Стартовое пиво положено только при балансе меньше 250 ₽.', '');
    }
  };
  document.getElementById('scrollGames').onclick = () => {
    document.querySelector('.games-grid').scrollIntoView({ behavior: 'smooth' });
  };

  /* ---------- звук ---------- */
  document.getElementById('soundBtn').onclick = (e) => {
    const on = PC.toggleSound();
    e.target.textContent = on ? '🔊' : '🔇';
  };

  /* ========== ЛИДЕРБОРД (топ по балансу) ========== */
  const lbBtn = document.getElementById('leaderboardBtn');
  const lbOverlay = document.getElementById('lbOverlay');
  const lbBody = document.getElementById('lbBody');
  lbBtn.onclick = () => { lbOverlay.classList.add('open'); renderLeaderboard(); };
  document.getElementById('lbClose').onclick = () => lbOverlay.classList.remove('open');
  lbOverlay.addEventListener('click', e => { if (e.target === lbOverlay) lbOverlay.classList.remove('open'); });

  async function renderLeaderboard() {
    lbBody.innerHTML = '<div class="hint">Собираем пенных магнатов...</div>';
    let board;
    try { board = await FB.listLeaderboard(); }
    catch (e) { lbBody.innerHTML = '<div class="hint" style="color:var(--danger)">Не удалось загрузить: ' + e.message + '</div>'; return; }

    // публичная витрина: leaderboard/<uid> = { nick, balance, hidden, games, maxWin }
    const isMeHidden = PC.loggedIn && !!PC.state.hidden;
    const list = Object.keys(board)
      .map(uid => ({ nick: (board[uid] && board[uid].nick) || 'гость', bal: (board[uid] && board[uid].balance) || 0, hidden: !!(board[uid] && board[uid].hidden), uid }))
      .filter(u => !u.hidden)
      .sort((a, b) => b.bal - a.bal)
      .slice(0, 20);

    lbBody.innerHTML = '';
    if (isMeHidden) {
      const note = document.createElement('div');
      note.className = 'hint';
      note.style.cssText = 'color:var(--gold);font-weight:700;padding:10px;margin-bottom:8px';
      note.innerHTML = '🕶️ Ты скрыт — тебя нет в лидерборде. Отключи в настройках, чтобы снова светиться.';
      lbBody.appendChild(note);
    }
    if (!list.length) { lbBody.innerHTML += '<div class="lb-empty">Никого нет. Первый пивной магнат — ты!</div>'; return; }

    const l = document.createElement('div');
    l.className = 'lb-list';
    const medals = ['🥇', '🥈', '🥉'];
    list.forEach((u, i) => {
      const row = document.createElement('div');
      row.className = 'lb-row' + (i < 3 ? ' top' + (i + 1) : '') + (u.uid === PC.uid ? ' lb-me' : '');
      row.style.animationDelay = (i * 0.04) + 's';
      row.innerHTML = `
        <span class="lb-place">${medals[i] || (i + 1)}</span>
        <span class="lb-nick">${u.nick}${u.uid === PC.uid ? ' (ты)' : ''}</span>
        <span class="lb-bal">${PC.fmt(u.bal)}</span>
      `;
      l.appendChild(row);
    });
    lbBody.appendChild(l);
    const ref = document.createElement('div');
    ref.className = 'lb-refresh';
    ref.innerHTML = '<button class="game-btn btn-ghost">🔄 Обновить</button>';
    ref.querySelector('button').onclick = () => { PC.click(); renderLeaderboard(); };
    lbBody.appendChild(ref);
  }

  /* ========== НАСТРОЙКИ ========== */
  const stBtn = document.getElementById('settingsBtn');
  const stOverlay = document.getElementById('settingsOverlay');
  const stBody = document.getElementById('settingsBody');
  stBtn.onclick = () => { stOverlay.classList.add('open'); renderSettings(); };
  document.getElementById('settingsClose').onclick = () => stOverlay.classList.remove('open');
  stOverlay.addEventListener('click', e => { if (e.target === stOverlay) stOverlay.classList.remove('open'); });

  function renderSettings() {
    stBody.innerHTML = `
      <div class="set-row">
        <div><div class="s-label">🧍 Ник</div>
        <div class="s-desc">Как тебя видно в лидерборде</div></div>
        <input type="text" id="setNick" value="${esc(PC.user || '')}" maxlength="20" class="set-input">
        <button class="btn btn-primary set-btn" id="setNickBtn">Сменить</button>
      </div>
      <div class="set-row">
        <div><div class="s-label">🔑 Пароль</div>
        <div class="s-desc">Смена пароля для входа (логин не меняется)</div></div>
        <div style="display:flex;gap:8px">
          <input type="password" id="setPassNew" placeholder="Новый пароль" class="set-input">
          <button class="btn btn-primary set-btn" id="setPassBtn">Сменить</button>
        </div>
      </div>
      <div class="set-row">
        <div><div class="s-label">🕶️ Скрывать меня в лидерборде</div>
        <div class="s-desc">По умолчанию выключено — ты виден всем</div></div>
        <label class="switch">
          <input type="checkbox" id="setHidden" ${PC.state.hidden ? 'checked' : ''}>
          <span class="track"></span><span class="knob"></span>
        </label>
      </div>
      <div class="set-row">
        <div><div class="s-label">🔊 Звук</div>
        <div class="s-desc">Глюки и пиликанье</div></div>
        <label class="switch">
          <input type="checkbox" id="setSound" ${PC.state.sound ? 'checked' : ''}>
          <span class="track"></span><span class="knob"></span>
        </label>
      </div>
    `;

    // смена ника
    const nickBtn = stBody.querySelector('#setNickBtn');
    nickBtn.onclick = async () => {
      const v = (stBody.querySelector('#setNick').value || '').trim();
      if (!v) { PC.toast('Введи новый ник', 'bad'); return; }
      const oldNick = PC.user;
      PC.user = v; // обновляем отображаемый ник
      PC.refreshUI();
      if (lbOverlay.classList.contains('open')) renderLeaderboard();
      try {
        // обновить users/<uid>/nick и leaderboard/<uid>/nick
        const cur = await FB.get('users/' + encodeURIComponent(PC.uid));
        if (cur) { cur.nick = v; await FB.set('users/' + encodeURIComponent(PC.uid), cur); }
        await FB.upsertLeaderboard(PC.uid, Object.assign({}, cur || {}, { nick: v }));
        PC.toast('🧍 Ник изменён: ' + v, 'good');
      } catch (e) {
        PC.user = oldNick; // откат, если не получилось
        PC.refreshUI();
        PC.toast('Не удалось сменить ник: ' + e.message, 'bad');
      }
    };

    // смена пароля (Firebase Auth updatePassword)
    const passBtn = stBody.querySelector('#setPassBtn');
    passBtn.onclick = async () => {
      const v = stBody.querySelector('#setPassNew').value;
      if (!v || v.length < 6) { PC.toast('Пароль должен быть от 6 символов', 'bad'); return; }
      passBtn.disabled = true;
      passBtn.textContent = 'Меняю...';
      try {
        const user = window.FIREBASE.current ? window.FIREBASE.current() : null;
        if (!user) throw new Error('Нет активной сессии');
        await user.updatePassword(v);
        // обновить копию пароля для админки (creds/<uid>), если такая есть
        try { const c = await FB.get('creds/' + encodeURIComponent(PC.uid)); if (c) await FB.set('creds/' + encodeURIComponent(PC.uid), Object.assign({}, c, { pass: v })); } catch (_) {}
        PC.toast('🔑 Пароль обновлён', 'good');
        stBody.querySelector('#setPassNew').value = '';
      } catch (e) {
        PC.toast('Не удалось сменить пароль: ' + (e.message || 'ошибка').replace('Firebase: ', ''), 'bad');
      } finally {
        passBtn.disabled = false;
        passBtn.textContent = 'Сменить';
      }
    };

    const h = stBody.querySelector('#setHidden');
    h.onchange = () => {
      PC.state.hidden = h.checked;
      // немедленно пишем отдельный параметр hidden в Firebase
      PC.save();
      PC.toast(h.checked ? '🕶️ Ты скрыт в лидерборде' : '🧍 Ты снова виден в лидерборде', 'good');
      // если лидерборд открыт — перерисовать сразу, чтобы изменения были видны
      if (lbOverlay.classList.contains('open')) renderLeaderboard();
    };
    const s = stBody.querySelector('#setSound');
    s.onchange = () => {
      PC.state.sound = s.checked;
      PC.refreshUI();
      document.getElementById('soundBtn').textContent = s.checked ? '🔊' : '🔇';
      PC.save();
    };
  }

  /* ========== ДРУЗЬЯ ========== */
  const frBtn = document.getElementById('friendsBtn');
  const frOverlay = document.getElementById('friendsOverlay');
  const frBody = document.getElementById('friendsBody');
  let frTab = 'out'; // out | in | list (по умолчанию Исходящие)

  frBtn.onclick = () => { frOverlay.classList.add('open'); frTab = 'out'; renderFriends(); };
  document.getElementById('friendsClose').onclick = () => frOverlay.classList.remove('open');
  frOverlay.addEventListener('click', e => { if (e.target === frOverlay) frOverlay.classList.remove('open'); });
  document.querySelectorAll('.fr-tab').forEach(t => {
    t.onclick = () => { frTab = t.getAttribute('data-fr'); renderFriends(); };
  });

  // ник берём из ПУБЛИЧНОЙ витрины leaderboard (users/<uid> закрыт для чужих → 401)
  async function friendNick(uid) {
    try {
      const lb = await FB.listLeaderboard();
      const d = lb[uid];
      return (d && d.nick) ? d.nick : uid.slice(0, 8);
    } catch (e) { return uid.slice(0, 8); }
  }

  function renderFriends() {
    document.querySelectorAll('.fr-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-fr') === frTab));
    if (frTab === 'out') renderFrOut();
    else if (frTab === 'in') renderFrIn();
    else renderFrList();
  }

  // ---- Исходящие: поиск + добавить ----
  async function renderFrOut() {
    frBody.innerHTML = `
      <div class="hint">Добавить друга — введи его ник (именно ник), найди и жми «Добавить».</div>
      <div style="display:flex;gap:8px;margin:12px 0">
        <input id="frSearch" class="set-input" style="flex:1" placeholder="Введи ник друга…" maxlength="20">
        <button id="frSearchBtn" class="btn btn-primary">🔍</button>
      </div>
      <div id="frSearchRes"></div>
    `;
    const inp = frBody.querySelector('#frSearch');
    const btn = frBody.querySelector('#frSearchBtn');
    const res = frBody.querySelector('#frSearchRes');

    async function doSearch() {
      const q = inp.value.trim();
      if (!q) { res.innerHTML = ''; return; }
      btn.disabled = true; btn.textContent = '…';
      try {
        const found = await FB.findByNick(q);
        const myUid = FB.myUid();
        const sentUids = await FB.friendList('out');
        const friendUids = await FB.friendList('list');
        res.innerHTML = found.length ? '' : '<div class="hint" style="color:var(--danger)">Никого не нашли.</div>';
        for (const f of found) {
          if (f.uid === myUid) continue;
          const row = document.createElement('div');
          row.className = 'fr-row';
          row.innerHTML = `<div class="fr-info"><div class="fr-nick">${esc(f.nick)}</div><div class="fr-stats">глубина баланс, ${f.games || 0} игр</div></div>`;
          if (friendUids.includes(f.uid)) {
            row.innerHTML += '<span style="color:var(--ok);font-weight:800">✓ друг</span>';
          } else if (sentUids.includes(f.uid)) {
            row.innerHTML += '<button class="btn btn-ghost fr-a" data-c="1">Отменить</button>';
          } else {
            row.innerHTML += '<button class="btn btn-primary fr-a" data-s="1">Добавить</button>';
          }
          const act = row.querySelector('.fr-a');
          if (act && act.dataset.s === '1') act.onclick = async () => { try { await FB.friendSend(f.uid); PC.toast('Заявка отправлена ' + f.nick, 'good'); } catch (e) { PC.toast(e.message, 'bad'); } doSearch(); };
          if (act && act.dataset.c === '1') act.onclick = async () => { try { await FB.friendCancel(f.uid); PC.toast('Отменено', 'good'); } catch (e) { PC.toast(e.message, 'bad'); } doSearch(); };
          res.appendChild(row);
        }
      } catch (e) { res.innerHTML = '<div class="hint" style="color:var(--danger)">' + esc(e.message) + '</div>'; }
      finally { btn.disabled = false; btn.textContent = '🔍'; }
    }
    btn.onclick = doSearch;
    inp.onkeydown = e => { if (e.key === 'Enter') doSearch(); };
  }

  // ---- Входящие: заявки ----
  async function renderFrIn() {
    frBody.innerHTML = '<div class="hint">Здесь ждут заявки от других игроков.</div><div id="frInList"></div>';
    const box = frBody.querySelector('#frInList');
    try {
      const uids = await FB.friendList('in');
      if (!uids.length) { box.innerHTML = '<div class="hint">Заявок нет.</div>'; return; }
      for (const uid of uids) {
        const nick = await friendNick(uid);
        const row = document.createElement('div');
        row.className = 'fr-row';
        row.innerHTML = `<div class="fr-info"><div class="fr-nick">${esc(nick)}</div></div>
          <button class="btn btn-primary fr-a" data-a="1">Принять</button>
          <button class="btn btn-ghost fr-a" data-d="1">Отклонить</button>`;
        row.querySelector('[data-a]').onclick = async () => { try { await FB.friendAccept(uid); PC.toast(nick + ' теперь друг', 'good'); } catch (e) { PC.toast(e.message, 'bad'); } renderFrIn(); };
        row.querySelector('[data-d]').onclick = async () => { try { await FB.friendDecline(uid); PC.toast('Отклонено', 'good'); } catch (e) { PC.toast(e.message, 'bad'); } renderFrIn(); };
        box.appendChild(row);
      }
    } catch (e) { box.innerHTML = '<div class="hint" style="color:var(--danger)">' + esc(e.message) + '</div>'; }
  }

  // ---- Список друзей ----
  async function renderFrList() {
    frBody.innerHTML = '<div class="hint">Твои друзья.</div><div id="frList"></div>';
    const box = frBody.querySelector('#frList');
    try {
      const uids = await FB.friendList('list');
      if (!uids.length) { box.innerHTML = '<div class="hint">Пока никого. Добавь друга во вкладке «Исходящие».</div>'; return; }
      for (const uid of uids) {
        const nick = await friendNick(uid);
        const row = document.createElement('div');
        row.className = 'fr-row';
        row.innerHTML = `<div class="fr-info"><div class="fr-nick">👥 ${esc(nick)}</div></div>
          <button class="btn btn-danger fr-a" data-r="1">Удалить</button>`;
        row.querySelector('[data-r]').onclick = async () => { try { await FB.friendRemove(uid); PC.toast(nick + ' удалён из друзей', 'good'); } catch (e) { PC.toast(e.message, 'bad'); } renderFrList(); };
        box.appendChild(row);
      }
    } catch (e) { box.innerHTML = '<div class="hint" style="color:var(--danger)">' + esc(e.message) + '</div>'; }
  }

  /* ========== ОПРЕДЕЛЕНИЕ УСТРОЙСТВА ========== */
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
  document.body.classList.add(isMobile ? 'device-mobile' : 'device-desktop');
  if (isMobile) {
    // отдельная мобильная версия: шрифт чуть крупнее, ветка настроек перекликается с CSS-брейкпоинтом
    document.documentElement.style.setProperty('--touch-target', '44px');
  }

  /* ---------- бегущая строка шуток ---------- */
  const ticker = document.getElementById('ticker');
  const seq = [...PC.jokes, ...PC.jokes];
  ticker.innerHTML = seq.map(j => '<span style="padding:0 40px">' + j + '</span>').join('');

  /* ---------- фон-пузырьки (canvas) ---------- */
  const canvas = document.getElementById('bubbles');
  const ctx = canvas.getContext('2d');
  let W, H, bubbles = [];
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  function makeBubble() {
    return {
      x: Math.random() * W,
      y: H + 20 + Math.random() * 40,
      r: 2 + Math.random() * 6,
      s: 0.3 + Math.random() * 0.9,
      o: 0.15 + Math.random() * 0.4,
      w: Math.random() * Math.PI * 2,
    };
  }
  function initBubbles() {
    bubbles = [];
    for (let i = 0; i < 40; i++) {
      const b = makeBubble();
      b.y = Math.random() * H;
      bubbles.push(b);
    }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    bubbles.forEach(b => {
      b.y -= b.s;
      b.x += Math.sin(b.w += 0.01) * 0.3;
      if (b.y < -20) Object.assign(b, makeBubble());
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(178,140,255,${b.o})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${b.o * 0.8})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  resize();
  initBubbles();
  window.addEventListener('resize', resize);
  draw();

  /* ---------- старт ---------- */
  renderCards();

  /* ---------- ВХОД ПО ЛОГИН + ПАРОЛЬ (Firebase Auth; юзеров регает админка) ---------- */
  const loginOverlay = document.getElementById('loginOverlay');
  const loginBtn = document.getElementById('loginBtn');
  const loginUid = document.getElementById('loginUid');
  const loginPin = document.getElementById('loginPin');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  function showLogin() {
    loginOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => (loginUid.value ? loginPin : loginUid).focus(), 100);
  }
  function hideLogin() {
    loginOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // показать экран «Аккаунт заблокирован» с причиной
  function showBan(reason) {
    // спрятать экран входа, показать бан-экран
    loginOverlay.classList.add('hidden');
    const banOv = document.getElementById('banOverlay');
    const reasonEl = document.getElementById('banReasonText');
    if (reasonEl) reasonEl.textContent = reason ? 'Причина: ' + reason : '';
    if (banOv) banOv.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    // выход с бан-экрана → снова экран логина
    const exitBtn = document.getElementById('banExit');
    if (exitBtn) {
      exitBtn.onclick = () => {
        if (banOv) banOv.classList.add('hidden');
        loginOverlay.classList.remove('hidden');
        document.body.style.overflow = '';
      };
    }
  }
  // спрятать бан-экран (при успешном входе)
  function hideBan() {
    const banOv = document.getElementById('banOverlay');
    if (banOv) banOv.classList.add('hidden');
  }

  // вход по логину+паролю
  async function doLogin(manual) {
    const login = loginUid.value.trim();
    const pass = loginPin.value;
    if (!login || !pass) { if (manual) loginError.textContent = 'Введи логин и пароль!'; return false; }
    if (manual) loginBtn.disabled = true;
    if (manual) loginError.textContent = 'Открываем столик...';
    try {
      const u = await FB.login(login, pass);
      if (!u) {
        if (manual) { loginError.textContent = 'Неверный логин или пароль.'; loginBtn.disabled = false; }
        return false;
      }
      // забанен — не пускаем, показываем бан-экран
      if (u.banned) {
        if (manual) { loginBtn.disabled = false; }
        showBan(u.banReason || 'Обратись к администратору.');
        return false;
      }
      // тизер при первом входе
      if (u.isNew) PC.toast('🆕 Новый гость — дарю 1000 ₽ на первый стол!', 'gold');
      enterSession(u);
      return true;
    } catch (e) {
      if (manual) {
        const msg = (e && e.code === 'auth/wrong-password' || e && e.code === 'auth/user-not-found')
          ? 'Неверный логин или пароль.'
          : (e && e.message && /warning|emulator|network/i.test(e.message) ? 'Ошибка связи с подвалом.' : 'Ошибка связи с подвалом. Попробуй ещё раз.');
        loginError.textContent = msg;
        loginBtn.disabled = false;
      }
      console.error('login err:', e && (e.code || e.message));
      return false;
    }
  }
  loginBtn.onclick = () => doLogin(true);
  [loginUid, loginPin].forEach(el => el && el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doLogin(true); }
  }));

  function enterSession(u) {
    PC.applyUser(u);
    hideLogin();
    hideBan();
    logoutBtn.style.display = 'inline-block';
    lbBtn.style.display = 'inline-block';
    stBtn.style.display = 'inline-block';
    frBtn.style.display = 'inline-block';
    document.getElementById('soundBtn').textContent = PC.state.sound ? '🔊' : '🔇';
    PC.refreshUI();
    startSync(); // запускаем живое обновление из RTDB
    PC.toast('🍻 Добро пожаловать, ' + (u.nick || 'гость') + '! Твой счёт: ' + PC.fmt(PC.state.balance), 'gold');
  }

  // выход из аккаунта — логаут Firebase, вернёмся на экран входа
  logoutBtn.onclick = async () => {
    PC.logout();
    stopSync(); // останавливаем синхронизацию при выходе
    try { await window.FIREBASE.signOutAuth(); } catch (e) {}
    logoutBtn.style.display = 'none';
    lbBtn.style.display = 'none';
    stBtn.style.display = 'none';
    frBtn.style.display = 'none';
    PC.refreshUI();
    renderCards();
    showLogin();
    PC.toast('🚪 Вышел из аккаунта. Хмельного вечера!', '');
  };

  /* ---------- ЖИВАЯ СИНХРОНИЗАЦИЯ С RTDB (каждые 10 сек) ---------- */
  let syncTimer = null;
  function startSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(async () => {
      if (!PC.loggedIn || !PC.uid) return;
      try {
        const fresh = await FB.get('users/' + encodeURIComponent(PC.uid));
        if (fresh) {
          // ===== ЧЕК БАНА (каждые 10 сек, вместе с остальной синхронизацией) =====
          // бан живёт в ЗАКРЫТОМ узле bans/<uid> — юзер не может снять его сам
          const ban = await FB.getBan(PC.uid).catch(() => ({ banned: false, reason: '' }));
          if (ban && ban.banned) {
            // выкидываем: стоп синка, логаут Firebase, экран «Аккаунт заблокирован»
            stopSync();
            PC.logout();
            try { await window.FIREBASE.signOutAuth(); } catch (e) {}
            logoutBtn.style.display = 'none';
            lbBtn.style.display = 'none';
            stBtn.style.display = 'none';
            frBtn.style.display = 'none';
            document.querySelectorAll('.modal-overlay').forEach(o => o.classList.remove('open'));
            document.body.style.overflow = '';
            PC.refreshUI();
            showBan(ban.reason || 'Обратись к администратору.');
            return;
          }
          const oldBal = PC.state.balance;
          PC.applyUser({ nick: PC.user, data: fresh, uid: PC.uid });
          if (fresh.balance > oldBal) {
            PC.toast('💸 Тебе начислили ' + PC.fmt(fresh.balance - oldBal), 'gold');
          }
          if (lbOverlay.classList.contains('open')) renderLeaderboard();
        }
      } catch (e) { /* тихо — переподключится на след. тике */ }
    }, 10000);
  }
  function stopSync() {
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  }

  /* ---------- ТЕХ. ПЕРЕРЫВ (maintenance: узел на корне базы, рядом с users) ---------- */
  const maintPage = document.getElementById('maintPage');
  let maintActive = false;
  let maintTimer = null;

  function showMaint() {
    maintActive = true;
    maintPage.classList.remove('hidden');
    // декор: падающие банки добавляем В BODY (не в grid-контейнер — иначе выстроятся колонкой!)
    if (!document.body.dataset.maintDecor) {
      document.body.dataset.maintDecor = '1';
      const COUNT = 10;
      for (let i = 0; i < COUNT; i++) {
        const d = document.createElement('div');
        d.className = 'maint-beer';
        d.textContent = ['🍺', '🍻', '💧'][i % 3];
        // равномерно разносим по ширине
        d.style.left = (4 + (92 / COUNT) * i + Math.random() * 4) + '%';
        // равномерно разносим по времени: отрицательная задержка сразу даёт разную фазу
        const dur = 9 + Math.random() * 6;
        d.style.animationDuration = dur + 's';
        d.style.animationDelay = -(dur / COUNT) * i + 's';
        d.style.fontSize = (20 + Math.random() * 16) + 'px';
        document.body.appendChild(d);
      }
    }
    document.body.style.overflow = 'hidden';
  }
  function hideMaint() {
    maintActive = false;
    maintPage.classList.add('hidden');
    document.body.style.overflow = '';
    // убрать декор, чтобы не летал на основном сайте
    document.body.dataset.maintDecor = '';
    document.querySelectorAll('.maint-beer').forEach(e => e.remove());
  }

  // проверка режима каждые 10 сек: true — не пускаем, false — впускаем
  async function checkMaint() {
    try {
      const on = await FB.getMaintenance();
      if (on && !maintActive) {
        showMaint();
        document.querySelectorAll('.modal-overlay').forEach(o => o.classList.remove('open'));
        PC.toast('🚧 Кабак закрылся на тех. перерыв!', 'bad');
      } else if (!on && maintActive) {
        hideMaint();
        PC.toast('🍻 Кабак снова открыт! Заходи!', 'gold');
      }
    } catch (e) { /* сеть недоступна — не мешаем */ }
  }

  async function boot() {
    // сперва проверяем тех. перерыв — если кабак закрыт, дальше не идём
    await checkMaint();
    // опрашиваем каждые 10 сек независимо (и при закрытом кабаке, и при открытом)
    maintTimer = setInterval(checkMaint, 10000);
    if (maintActive) return; // на заглушке — сайт закрыт

    // Firebase восстанавливает сессию АСИНХРОННО. Ждём первого события onAuthStateChanged,
    // потом решаем: есть юзер — автовход, нет — экран логина.
    const restoreCur = () => new Promise(resolve => {
      if (!window.FIREBASE || !window.FIREBASE.onAuthChange) {
        resolve(window.FIREBASE && window.FIREBASE.current ? window.FIREBASE.current() : null);
        return;
      }
      let done = false;
      const unsub = window.FIREBASE.onAuthChange(user => {
        if (done) return;
        done = true;
        if (typeof unsub === 'function') unsub();
        resolve(user || null);
      });
      // страховка: если событие не придёт за 4 сек — берём текущее состояние
      setTimeout(() => {
        if (done) return;
        done = true;
        if (typeof unsub === 'function') unsub();
        resolve(window.FIREBASE.current ? window.FIREBASE.current() : null);
      }, 4000);
    });

    showLogin();
    loginError.textContent = 'Проверяем сессию...';
    const cur = await restoreCur();
    if (cur) {
      loginError.textContent = 'Входим автоматически...';
      try {
        const u = await FB.loadSession(cur.uid, cur.email);
        if (u) {
          if (u.banned) { showBan(u.banReason || 'Обратись к администратору.'); return; }
          enterSession(u); return;
        }
      } catch (e) { console.warn('auto-login failed', e); }
      loginError.textContent = 'Не удалось войти автоматически — введи логин и пароль.';
    } else {
      loginError.textContent = '';
    }
  }
  boot();
})();
