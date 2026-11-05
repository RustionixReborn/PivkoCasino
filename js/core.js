/* ============ ПИВКО КАЗИНО — ЯДРО ============ */
const PC = window.PC = (() => {
  const state = {
    balance: 0,
    gains: 0,
    games: 0,
    maxWin: 0,
    luck: 0,
    sound: true,
    hidden: false, // скрывать ли меня из лидерборда (по умолчанию — видим)
  };
  const fmt = n => Math.round(n).toLocaleString('ru-RU') + ' ₽';

  /* ---- шутки про пиво (много!) ---- */
  const jokes = [
    'Пиво — это жидкий хлеб. Мы тут, считай, булочная.',
    'Пью пиво — значит, боремся с авитаминозом дрожжей.',
    'Казино выигрывает всегда. Но мы договорились иначе.',
    'Мой банк — это банка. И она почти пуста.',
    'Пивко — это единственное, что никогда не предаёт. Ну, кроме слива в конце.',
    '50 ₽ за спин? Подешевле, чем инструкция к IKEA.',
    'Алкогольная арифметика: 1 + 1 = бутылочка.',
    'Удачу нельзя купить. Но 50 ₽ делают её очень сговорчивой.',
    'Джекпот в Пивко Казино — это холодное пиво, ждущее тебя дома.',
    'Ставлю на красное. Или на нефильтрованное. Как повезёт.',
    'У меня улыбка до ушей, как пена из лишней банки.',
    'Пиво — решение. Остальные вопросы не так важны.',
    'Крутка барабана — это как открытие банки: никогда не знаешь, что брызнет.',
    'В этом казино все выигрыши пенятся от радости.',
    'Лучше пиво в руке, чем параллельная вселенная, где его нет.',
    'Минимальная ставка — 5 ₽. Максимальное удовольствие — бесценно.',
    'Трезвый в казино — как пустая кружка: так себе зрелище.',
    'Если вдруг проиграл — не грусти, это просто пиво вложилось в будущее.',
    'Прокачал пузо, теперь качаю баланс. План ясен.',
    'Джекпот сорвал? Поздравляю! Ты теперь почётный пивной магнат.',
    'Пиво — это тип, который всегда за тебя. И внутри тебя.',
    'Дрожжи — это такие микробы-оптимисты. Пьём за них.',
    'Слоты крутятся, пенка стоит, настроение на высоте.',
    'Казино: место, где взрослые дяди просят у экрана ещё одну банку.',
    'Одна банка — начало. Двадцать — уже легенда.',
    'Выигрыш в 5 ₽ — это не мало. Это четыре пятых следующей кружки.',
  ];

  /* ---- звук (Web Audio, короткие бипы) ---- */
  let actx = null;
  function beep(freq, dur, type = 'square', vol = 0.08) {
    if (!state.sound) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(vol, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) {}
  }
  return {
    state, fmt, jokes,
    win(n) { beep(660, .12); setTimeout(() => beep(880, .16), 100); },
    lose() { beep(220, .25, 'sawtooth', .05); },
    click() { beep(520, .05); },
    toggleSound() {
      state.sound = !state.sound;
      if (state.sound) beep(700, .12);
      return state.sound;
    },
    balance(n) { // зачислить, вернуть новое значение
      state.balance += n;
      if (n > 0) state.gains += n;
      if (n > state.maxWin) state.maxWin = n;
      let el = document.getElementById('balance');
      if (el) {
        el.textContent = fmt(state.balance);
        el.classList.remove('pulse'); void el.offsetWidth;
        if (n > 0) el.classList.add('pulse');
      }
      PC.scheduleSave();
      return state.balance;
    },
    dec(n) { // списать, может уйти в минус
      state.balance -= n;
      let el = document.getElementById('balance');
      if (el) el.textContent = fmt(state.balance);
      PC.scheduleSave();
      return state.balance;
    },
    afford(n) { return state.balance >= n; },
    tryBet(n) { if (state.balance < n) { PC.toast('Не хватает рублей! Крути дёшево или жди пива 😅', 'bad'); return false; } return true; },
    played() {
      state.games++;
      state.luck = state.games > 0 ? Math.round((state.gains / (state.gains + 100 * state.games)) * 100) : 0;
      document.getElementById('statGames').textContent = state.games;
      document.getElementById('statGains').textContent = fmt(state.gains);
      document.getElementById('statMax').textContent = fmt(state.maxWin);
      document.getElementById('statLuck').textContent = state.luck + '%';
      PC.save(); // автосохранение после каждого хода
    },
    toast(msg, type = '') {
      const w = document.getElementById('toast-wrap');
      const t = document.createElement('div');
      t.className = 'toast ' + type;
      t.textContent = msg;
      w.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    },
    bubblePop() { // плавающий поп
      const el = document.getElementById('bubble-pop');
      if (!el) return;
      el.style.left = (20 + Math.random() * 60) + 'vw';
      el.style.top = (30 + Math.random() * 40) + 'vh';
      el.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
      el.style.setProperty('--dy', (-40 - Math.random() * 60) + 'px');
      el.textContent = ['💧','💵','💰','🤩','🍺'][Math.floor(Math.random() * 5)];
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    },
    confetti() { // конфетти из банок и монет
      const n = 26;
      for (let i = 0; i < n; i++) {
        const d = document.createElement('div');
        d.style.cssText = `position:fixed;z-index:130;pointer-events:none;font-size:${18 + Math.random() * 20}px;
          left:${Math.random() * 100}vw;top:-40px;opacity:0;transition:transform ${1.2 + Math.random()}.8s ${'cubic-bezier(.2,.8,.3,1)'},opacity .8s ease;`;
        d.textContent = ['🍺','💰','💵','🍻','✨','💵'][Math.floor(Math.random() * 6)];
        document.body.appendChild(d);
        requestAnimationFrame(() => {
          d.style.transform = `translateY(${90 + Math.random() * 40}vh) rotate(${360 + Math.random() * 720}deg)`;
          d.style.opacity = 1;
        });
        setTimeout(() => d.remove(), 2400);
      }
    },
    randJoke() { return jokes[Math.floor(Math.random() * jokes.length)]; },
    flip() { return Math.random() < 0.5; },
    rnd(a, b) { return a + Math.random() * (b - a); },

    // отложенное сохранение (не спамим базу на каждый клик)
    scheduleSave() {
      clearTimeout(PC._saveTimer);
      PC._saveTimer = setTimeout(() => PC.save(), 400);
    },

    /* ============ АККАУНТ И СОХРАНЕНИЕ (Firebase RTDB) ============ */
    // Вся статистика живёт в памяти и синхронизируется с users/<ник>/.
    user: null,       // { nick, key } — текущий вошедший пользователь
    loggedIn: false,

    // после успешного входа: применить статистику из базы
    applyUser(u) {
      PC.user = u.nick;
      PC.userKey = u.data ? u.data.key : null;
      PC.loggedIn = true;
      const d = u.data || {};
      for (const k of ['balance','gains','games','maxWin','luck','sound','hidden']) {
        if (typeof d[k] === 'number' || typeof d[k] === 'boolean') state[k] = d[k];
      }
      PC.renderStats();
      PC.refreshUI();
    },
    // перерисовать статистику из state
    renderStats() {
      document.getElementById('statGames').textContent = state.games;
      document.getElementById('statGains').textContent = fmt(state.gains);
      document.getElementById('statMax').textContent = fmt(state.maxWin);
      document.getElementById('statLuck').textContent = state.luck + '%';
    },
    // обновить верхний баланс
    refreshUI() {
      let el = document.getElementById('balance');
      if (el) el.textContent = fmt(state.balance);
      let who = document.getElementById('whoAmI');
      if (who) who.textContent = PC.loggedIn ? '🍺 ' + PC.user : 'гость';
    },
    // записать всю статистику текущего пользователя в RTDB
    async save() {
      if (!PC.loggedIn) return;
      try {
        await FB.set('users/' + PC.user, {
          key: PC.userKey || null,
          balance: state.balance,
          gains: state.gains,
          games: state.games,
          maxWin: state.maxWin,
          luck: state.luck,
          sound: state.sound,
          hidden: !!state.hidden,
          savedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Firebase save failed', e);
      }
    },
    // выйти из аккаунта
    logout() {
      PC.user = null;
      PC.loggedIn = false;
      // сброс локальной статистики
      for (const k of ['balance','gains','games','maxWin','luck','hidden']) state[k] = k === 'hidden' ? false : 0;
      PC.refreshUI();
    },
    /* ============ ГЛАВНАЯ КНОПКА (действие в модалке) ============ */
    mainAction: null, // { label, fn }
    setMain(label, fn) {
      PC.mainAction = { label, fn };
      const b = document.getElementById('playBtn');
      if (b) b.textContent = label;
    },
    takeMain() { // вызвать зарегистрированное действие и сбросить
      if (PC.mainAction && PC.mainAction.fn) PC.mainAction.fn();
    },
    debounce(fn, ms) {
      let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    },
  };
})();
PC.games = PC.games || {}; // регистр игр (каждая игра пишет сюда)