/* ============ ПИВКО КАЗИНО — ОСНОВНОЙ СЦЕНАРИЙ ============ */
(() => {
  const games = Object.values(PC.games); // только 5 оставшихся

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
        <input type="number" id="betCustom" class="bet-input" min="1" placeholder="свой размер">
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
  }

  /* ---------- СТАРТ ИГРЫ (списание ставки) ---------- */
  function startGame(g, bet) {
    if (!g.free) {
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
    PC.click();
    modalGame.innerHTML = '';
    g.start(modalGame, bet, () => showBetScreen(g));
  }

  /* ---------- приветствие: стартовое пиво ---------- */
  document.getElementById('welcomeBtn').onclick = () => {
    if (!PC.loggedIn) { PC.toast('🔒 Сначала введи пивное кодовое слово!', 'bad'); return; }
    PC.click();
    if (PC.state.balance === 0) {
      PC.balance(2500);
      PC.confetti();
      PC.toast('🍺 Стартовое пиво: +2500 ₽! Теперь можно и поставить по-крупному.', 'gold');
    } else if (PC.state.balance < 500) {
      PC.balance(1000);
      PC.bubblePop();
      PC.toast('🍻 Бармен подливает: +1000 ₽. Не пропей всё сразу!', 'gold');
    } else {
      PC.toast('🍻 У тебя уже есть чем играть. Бармен одобрительно кивает.', '');
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
    let users;
    try { users = await FB.listUsers(); }
    catch (e) { lbBody.innerHTML = '<div class="hint" style="color:var(--danger)">Не удалось загрузить: ' + e.message + '</div>'; return; }

    // фильтр: скрывшие себя (hidden:true) НЕ попадают в список вообще — ни себе, ни другим
    const isMeHidden = PC.loggedIn && !!PC.state.hidden;
    const list = Object.keys(users)
      .map(nick => ({ nick, bal: (users[nick] && users[nick].balance) || 0, hidden: !!(users[nick] && users[nick].hidden) }))
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
      row.className = 'lb-row' + (i < 3 ? ' top' + (i + 1) : '') + (u.nick === PC.user ? ' lb-me' : '');
      row.style.animationDelay = (i * 0.04) + 's';
      row.innerHTML = `
        <span class="lb-place">${medals[i] || (i + 1)}</span>
        <span class="lb-nick">${u.nick}${u.nick === PC.user ? ' (ты)' : ''}</span>
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

  /* ---------- ВХОД ПО ПИВНОМУ КОДОВОМУ СЛОВУ (+ запоминание ключа) ---------- */
  const loginOverlay = document.getElementById('loginOverlay');
  const loginKey = document.getElementById('loginKey');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');
  const KEY_MEM = 'pivko_saved_key'; // localStorage: запомненный ключ

  function showLogin() {
    loginOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => loginKey.focus(), 100);
  }
  function hideLogin() {
    loginOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // вход с ключом; manual — показывать ли ошибки на экране
  async function doLogin(manual, keyToTry) {
    const key = keyToTry || loginKey.value.trim();
    if (!key) { if (manual) loginError.textContent = 'Введи пивное кодовое слово!'; return false; }
    if (manual) loginBtn.disabled = true;
    if (manual) loginError.textContent = 'Проверяем пенные учётки...';
    try {
      const u = await FB.login(key);
      if (!u) {
        if (manual) { loginError.textContent = 'Не то слово. Дверь кабака не открылась.'; }
        return false;
      }
      // удачная сессия → запоминаем ключ для авто-входа
      try { localStorage.setItem(KEY_MEM, key); } catch (e) {}
      enterSession(u);
      return true;
    } catch (e) {
      if (manual) { loginError.textContent = 'Ошибка связи с подвалом. Попробуй ещё раз.'; loginBtn.disabled = false; }
      console.error(e);
      return false;
    }
  }
  function enterSession(u) {
    PC.applyUser(u);
    hideLogin();
    logoutBtn.style.display = 'inline-block';
    lbBtn.style.display = 'inline-block';
    stBtn.style.display = 'inline-block';
    // админка доступна только пользователю admin
    adminBtn.style.display = (u.nick === 'admin') ? 'inline-block' : 'none';
    document.getElementById('soundBtn').textContent = PC.state.sound ? '🔊' : '🔇';
    PC.refreshUI();
    startSync(); // запускаем живое обновление из RTDB
    PC.toast('🍻 Добро пожаловать, ' + u.nick + '! Твой счёт: ' + PC.fmt(PC.state.balance), 'gold');
  }
  loginBtn.onclick = () => { doLogin(true); };
  loginKey.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doLogin(true); } });

  // выход из аккаунта: чистим запомненный ключ — вернётся на экран входа
  logoutBtn.onclick = () => {
    try { localStorage.removeItem(KEY_MEM); } catch (e) {}
    PC.logout();
    stopSync(); // останавливаем синхронизацию при выходе
    logoutBtn.style.display = 'none';
    adminBtn.style.display = 'none';
    lbBtn.style.display = 'none';
    stBtn.style.display = 'none';
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
      if (!PC.loggedIn) return;
      try {
        const fresh = await FB.get('users/' + encodeURIComponent(PC.user));
        if (fresh) {
          const oldBal = PC.state.balance;
          PC.applyUser({ nick: PC.user, data: fresh });
          // если админ добавил денег — показать пользователю
          if (fresh.balance > oldBal) {
            PC.toast('💸 Тебе начислили ' + PC.fmt(fresh.balance - oldBal), 'gold');
          }
          // если открыт лидерборд — обновить
          if (lbOverlay.classList.contains('open')) renderLeaderboard();
        }
      } catch (e) { /* тихо — переподключится на след. тике */ }
    }, 10000);
  }
  function stopSync() {
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  }

  /* ---------- АДМИНКА (управление юзерами; доступна admin) ---------- */
  const adminBtn = document.getElementById('adminBtn');
  const adminOverlay = document.getElementById('adminOverlay');
  const adminBody = document.getElementById('adminBody');
  adminBtn.onclick = () => { adminOverlay.classList.add('open'); adminBody.innerHTML = ''; renderAdmin(); };
  document.getElementById('adminClose').onclick = () => adminOverlay.classList.remove('open');
  adminOverlay.addEventListener('click', e => { if (e.target === adminOverlay) adminOverlay.classList.remove('open'); });

  async function renderAdmin() {
    adminBody.innerHTML = '<div class="hint">Загрузка пенных учёток...</div>';
    let users;
    try { users = await FB.listUsers(); }
    catch (e) { adminBody.innerHTML = '<div class="hint" style="color:var(--danger)">Ошибка загрузки: ' + e.message + '</div>'; return; }
    adminBody.innerHTML = '';
    const head = document.createElement('div');
    head.innerHTML = '<div class="hint" style="margin-bottom:4px">Всего юзеров: <b>' + Object.keys(users).length + '</b></div>';
    adminBody.appendChild(head);
    const list = document.createElement('div');
    list.className = 'admin-list';
    Object.keys(users).forEach(nick => {
      const u = users[nick] || {};
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `
        <span class="a-nick">${nick}</span>
        <span class="a-key">🔑 ${u.key || 'нет'}</span>
        <span class="a-bal" style="font-weight:700;color:var(--gold);font-size:13px">${PC.fmt(u.balance || 0)}</span>
      `;
      // поле + кнопка «добавить денег»
      const addWrap = document.createElement('div');
      addWrap.className = 'admin-add';
      addWrap.innerHTML = `
        <input type="number" class="a-add-in" min="1" placeholder="+₽" title="Сколько добавить">
        <button class="game-btn btn-gold a-add-btn" title="Добавить денег">➕</button>
      `;
      addWrap.querySelector('.a-add-btn').onclick = async () => {
        const amt = parseInt(addWrap.querySelector('.a-add-in').value, 10);
        if (!amt || amt <= 0) { PC.toast('Введи сумму для добавления.', 'bad'); return; }
        try {
          await FB.addBalance(nick, amt);
          PC.toast('💸 ' + nick + ' +' + PC.fmt(amt), 'gold');
          renderAdmin();
        } catch (e) { PC.toast('Ошибка: ' + e.message, 'bad'); }
      };
      row.appendChild(addWrap);
      const del = document.createElement('button');
      del.className = 'game-btn btn-danger a-del';
      del.style.padding = '6px 10px'; del.style.fontSize = '13px';
      del.textContent = '🗑';
      del.title = 'Удалить ' + nick;
      del.onclick = async () => {
        if (!confirm('Точно удалить ' + nick + '?')) return;
        try { await FB.deleteUser(nick); renderAdmin(); PC.toast('🗑 Удалён ' + nick, 'bad'); }
        catch (e) { PC.toast('Ошибка: ' + e.message, 'bad'); }
      };
      row.appendChild(del);
      list.appendChild(row);
    });
    adminBody.appendChild(list);
    // форма добавления
    const form = document.createElement('div');
    form.className = 'admin-form';
    form.innerHTML = `
      <div class="hint" style="margin:0;font-weight:700">Добавить юзера</div>
      <input id="adNick" placeholder="Ник (напр. petr)">
      <input id="adKey" placeholder="Пивное кодовое слово (создаёшь сам)">
      <input id="adBal" type="number" placeholder="Стартовый баланс ₽ (по умолч. 1000)">
      <button class="game-btn btn-primary" id="adAdd">➕ Создать аккаунт</button>
    `;
    adminBody.appendChild(form);
    adminBody.querySelector('#adAdd').onclick = async () => {
      const nick = adminBody.querySelector('#adNick').value.trim();
      const key = adminBody.querySelector('#adKey').value.trim();
      const bal = parseInt(adminBody.querySelector('#adBal').value, 10) || 1000;
      if (!nick || !key) { PC.toast('Введи ник И ключ!', 'bad'); return; }
      try {
        await FB.createUser(nick, key, bal);
        PC.toast('✅ Создан ' + nick + ' (ключ: ' + key + ')', 'gold');
        renderAdmin();
      } catch (e) { PC.toast('Ошибка: ' + e.message, 'bad'); }
    };
  }

  async function boot() {
    // сперва — экран входа
    showLogin();
    // авто-вход: если есть запомненный ключ — пробуем войти молча
    let savedKey = null;
    try { savedKey = localStorage.getItem(KEY_MEM); } catch (e) {}
    if (savedKey) {
      loginError.textContent = 'Пробуем войти автоматически...';
      const ok = await doLogin(false, savedKey);
      if (!ok) {
        // ключ протух/неверен — чистим и оставляем на экране входа
        try { localStorage.removeItem(KEY_MEM); } catch (e) {}
        loginError.textContent = 'Сохранённый ключ не подошёл. Введи правильное пивное слово.';
      }
    }
  }
  boot();
})();
