/* ============ РџРР’РљРћ РљРђР—РРќРћ вЂ” РЇР”Р Рћ ============ */
const PC = window.PC = (() => {
  const state = {
    balance: 0,
    gains: 0,
    games: 0,
    maxWin: 0,
    luck: 0,
    sound: true,
    hidden: false, // СЃРєСЂС‹РІР°С‚СЊ Р»Рё РјРµРЅСЏ РёР· Р»РёРґРµСЂР±РѕСЂРґР° (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ вЂ” РІРёРґРёРј)
  };
  const fmt = n => Math.round(n).toLocaleString('ru-RU') + ' в‚Ѕ';

  /* ---- С€СѓС‚РєРё РїСЂРѕ РїРёРІРѕ (РјРЅРѕРіРѕ!) ---- */
  const jokes = [
    'РџРёРІРѕ вЂ” СЌС‚Рѕ Р¶РёРґРєРёР№ С…Р»РµР±. РњС‹ С‚СѓС‚, СЃС‡РёС‚Р°Р№, Р±СѓР»РѕС‡РЅР°СЏ.',
    'РџСЊСЋ РїРёРІРѕ вЂ” Р·РЅР°С‡РёС‚, Р±РѕСЂРµРјСЃСЏ СЃ Р°РІРёС‚Р°РјРёРЅРѕР·РѕРј РґСЂРѕР¶Р¶РµР№.',
    'РљР°Р·РёРЅРѕ РІС‹РёРіСЂС‹РІР°РµС‚ РІСЃРµРіРґР°. РќРѕ РјС‹ РґРѕРіРѕРІРѕСЂРёР»РёСЃСЊ РёРЅР°С‡Рµ.',
    'РњРѕР№ Р±Р°РЅРє вЂ” СЌС‚Рѕ Р±Р°РЅРєР°. Р РѕРЅР° РїРѕС‡С‚Рё РїСѓСЃС‚Р°.',
    'РџРёРІРєРѕ вЂ” СЌС‚Рѕ РµРґРёРЅСЃС‚РІРµРЅРЅРѕРµ, С‡С‚Рѕ РЅРёРєРѕРіРґР° РЅРµ РїСЂРµРґР°С‘С‚. РќСѓ, РєСЂРѕРјРµ СЃР»РёРІР° РІ РєРѕРЅС†Рµ.',
    '50 в‚Ѕ Р·Р° СЃРїРёРЅ? РџРѕРґРµС€РµРІР»Рµ, С‡РµРј РёРЅСЃС‚СЂСѓРєС†РёСЏ Рє IKEA.',
    'РђР»РєРѕРіРѕР»СЊРЅР°СЏ Р°СЂРёС„РјРµС‚РёРєР°: 1 + 1 = Р±СѓС‚С‹Р»РѕС‡РєР°.',
    'РЈРґР°С‡Сѓ РЅРµР»СЊР·СЏ РєСѓРїРёС‚СЊ. РќРѕ 50 в‚Ѕ РґРµР»Р°СЋС‚ РµС‘ РѕС‡РµРЅСЊ СЃРіРѕРІРѕСЂС‡РёРІРѕР№.',
    'Р”Р¶РµРєРїРѕС‚ РІ РџРёРІРєРѕ РљР°Р·РёРЅРѕ вЂ” СЌС‚Рѕ С…РѕР»РѕРґРЅРѕРµ РїРёРІРѕ, Р¶РґСѓС‰РµРµ С‚РµР±СЏ РґРѕРјР°.',
    'РЎС‚Р°РІР»СЋ РЅР° РєСЂР°СЃРЅРѕРµ. РР»Рё РЅР° РЅРµС„РёР»СЊС‚СЂРѕРІР°РЅРЅРѕРµ. РљР°Рє РїРѕРІРµР·С‘С‚.',
    'РЈ РјРµРЅСЏ СѓР»С‹Р±РєР° РґРѕ СѓС€РµР№, РєР°Рє РїРµРЅР° РёР· Р»РёС€РЅРµР№ Р±Р°РЅРєРё.',
    'РџРёРІРѕ вЂ” СЂРµС€РµРЅРёРµ. РћСЃС‚Р°Р»СЊРЅС‹Рµ РІРѕРїСЂРѕСЃС‹ РЅРµ С‚Р°Рє РІР°Р¶РЅС‹.',
    'РљСЂСѓС‚РєР° Р±Р°СЂР°Р±Р°РЅР° вЂ” СЌС‚Рѕ РєР°Рє РѕС‚РєСЂС‹С‚РёРµ Р±Р°РЅРєРё: РЅРёРєРѕРіРґР° РЅРµ Р·РЅР°РµС€СЊ, С‡С‚Рѕ Р±СЂС‹Р·РЅРµС‚.',
    'Р’ СЌС‚РѕРј РєР°Р·РёРЅРѕ РІСЃРµ РІС‹РёРіСЂС‹С€Рё РїРµРЅСЏС‚СЃСЏ РѕС‚ СЂР°РґРѕСЃС‚Рё.',
    'Р›СѓС‡С€Рµ РїРёРІРѕ РІ СЂСѓРєРµ, С‡РµРј РїР°СЂР°Р»Р»РµР»СЊРЅР°СЏ РІСЃРµР»РµРЅРЅР°СЏ, РіРґРµ РµРіРѕ РЅРµС‚.',
    'РњРёРЅРёРјР°Р»СЊРЅР°СЏ СЃС‚Р°РІРєР° вЂ” 5 в‚Ѕ. РњР°РєСЃРёРјР°Р»СЊРЅРѕРµ СѓРґРѕРІРѕР»СЊСЃС‚РІРёРµ вЂ” Р±РµСЃС†РµРЅРЅРѕ.',
    'РўСЂРµР·РІС‹Р№ РІ РєР°Р·РёРЅРѕ вЂ” РєР°Рє РїСѓСЃС‚Р°СЏ РєСЂСѓР¶РєР°: С‚Р°Рє СЃРµР±Рµ Р·СЂРµР»РёС‰Рµ.',
    'Р•СЃР»Рё РІРґСЂСѓРі РїСЂРѕРёРіСЂР°Р» вЂ” РЅРµ РіСЂСѓСЃС‚Рё, СЌС‚Рѕ РїСЂРѕСЃС‚Рѕ РїРёРІРѕ РІР»РѕР¶РёР»РѕСЃСЊ РІ Р±СѓРґСѓС‰РµРµ.',
    'РџСЂРѕРєР°С‡Р°Р» РїСѓР·Рѕ, С‚РµРїРµСЂСЊ РєР°С‡Р°СЋ Р±Р°Р»Р°РЅСЃ. РџР»Р°РЅ СЏСЃРµРЅ.',
    'Р”Р¶РµРєРїРѕС‚ СЃРѕСЂРІР°Р»? РџРѕР·РґСЂР°РІР»СЏСЋ! РўС‹ С‚РµРїРµСЂСЊ РїРѕС‡С‘С‚РЅС‹Р№ РїРёРІРЅРѕР№ РјР°РіРЅР°С‚.',
    'РџРёРІРѕ вЂ” СЌС‚Рѕ С‚РёРї, РєРѕС‚РѕСЂС‹Р№ РІСЃРµРіРґР° Р·Р° С‚РµР±СЏ. Р РІРЅСѓС‚СЂРё С‚РµР±СЏ.',
    'Р”СЂРѕР¶Р¶Рё вЂ” СЌС‚Рѕ С‚Р°РєРёРµ РјРёРєСЂРѕР±С‹-РѕРїС‚РёРјРёСЃС‚С‹. РџСЊС‘Рј Р·Р° РЅРёС….',
    'РЎР»РѕС‚С‹ РєСЂСѓС‚СЏС‚СЃСЏ, РїРµРЅРєР° СЃС‚РѕРёС‚, РЅР°СЃС‚СЂРѕРµРЅРёРµ РЅР° РІС‹СЃРѕС‚Рµ.',
    'РљР°Р·РёРЅРѕ: РјРµСЃС‚Рѕ, РіРґРµ РІР·СЂРѕСЃР»С‹Рµ РґСЏРґРё РїСЂРѕСЃСЏС‚ Сѓ СЌРєСЂР°РЅР° РµС‰С‘ РѕРґРЅСѓ Р±Р°РЅРєСѓ.',
    'РћРґРЅР° Р±Р°РЅРєР° вЂ” РЅР°С‡Р°Р»Рѕ. Р”РІР°РґС†Р°С‚СЊ вЂ” СѓР¶Рµ Р»РµРіРµРЅРґР°.',
    'Р’С‹РёРіСЂС‹С€ РІ 5 в‚Ѕ вЂ” СЌС‚Рѕ РЅРµ РјР°Р»Рѕ. Р­С‚Рѕ С‡РµС‚С‹СЂРµ РїСЏС‚С‹С… СЃР»РµРґСѓСЋС‰РµР№ РєСЂСѓР¶РєРё.',
  ];

  /* ---- Р·РІСѓРє (Web Audio, РєРѕСЂРѕС‚РєРёРµ Р±РёРїС‹) ---- */
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
    balance(n) { // Р·Р°С‡РёСЃР»РёС‚СЊ, РІРµСЂРЅСѓС‚СЊ РЅРѕРІРѕРµ Р·РЅР°С‡РµРЅРёРµ
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
    dec(n) { // СЃРїРёСЃР°С‚СЊ, РјРѕР¶РµС‚ СѓР№С‚Рё РІ РјРёРЅСѓСЃ
      state.balance -= n;
      let el = document.getElementById('balance');
      if (el) el.textContent = fmt(state.balance);
      PC.scheduleSave();
      return state.balance;
    },
    afford(n) { return state.balance >= n; },
    tryBet(n) { if (state.balance < n) { PC.toast('РќРµ С…РІР°С‚Р°РµС‚ СЂСѓР±Р»РµР№! РљСЂСѓС‚Рё РґС‘С€РµРІРѕ РёР»Рё Р¶РґРё РїРёРІР° рџ…', 'bad'); return false; } return true; },
    played() {
      state.games++;
      state.luck = state.games > 0 ? Math.round((state.gains / (state.gains + 100 * state.games)) * 100) : 0;
      document.getElementById('statGames').textContent = state.games;
      document.getElementById('statGains').textContent = fmt(state.gains);
      document.getElementById('statMax').textContent = fmt(state.maxWin);
      document.getElementById('statLuck').textContent = state.luck + '%';
      PC.save(); // Р°РІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёРµ РїРѕСЃР»Рµ РєР°Р¶РґРѕРіРѕ С…РѕРґР°
    },
    toast(msg, type = '') {
      const w = document.getElementById('toast-wrap');
      const t = document.createElement('div');
      t.className = 'toast ' + type;
      t.textContent = msg;
      w.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    },
    bubblePop() { // РїР»Р°РІР°СЋС‰РёР№ РїРѕРї
      const el = document.getElementById('bubble-pop');
      if (!el) return;
      el.style.left = (20 + Math.random() * 60) + 'vw';
      el.style.top = (30 + Math.random() * 40) + 'vh';
      el.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
      el.style.setProperty('--dy', (-40 - Math.random() * 60) + 'px');
      el.textContent = ['рџ’§','рџ’µ','рџ’°','рџ¤©','рџЌє'][Math.floor(Math.random() * 5)];
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    },
    confetti() { // РєРѕРЅС„РµС‚С‚Рё РёР· Р±Р°РЅРѕРє Рё РјРѕРЅРµС‚
      const n = 26;
      for (let i = 0; i < n; i++) {
        const d = document.createElement('div');
        d.style.cssText = `position:fixed;z-index:130;pointer-events:none;font-size:${18 + Math.random() * 20}px;
          left:${Math.random() * 100}vw;top:-40px;opacity:0;transition:transform ${1.2 + Math.random()}.8s ${'cubic-bezier(.2,.8,.3,1)'},opacity .8s ease;`;
        d.textContent = ['рџЌє','рџ’°','рџ’µ','рџЌ»','вњЁ','рџ’µ'][Math.floor(Math.random() * 6)];
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

    // РѕС‚Р»РѕР¶РµРЅРЅРѕРµ СЃРѕС…СЂР°РЅРµРЅРёРµ (РЅРµ СЃРїР°РјРёРј Р±Р°Р·Сѓ РЅР° РєР°Р¶РґС‹Р№ РєР»РёРє)
    scheduleSave() {
      clearTimeout(PC._saveTimer);
      PC._saveTimer = setTimeout(() => PC.save(), 400);
    },

    /* ============ РђРљРљРђРЈРќРў Р РЎРћРҐР РђРќР•РќРР• (Firebase RTDB) ============ */
    // Р’СЃСЏ СЃС‚Р°С‚РёСЃС‚РёРєР° Р¶РёРІС‘С‚ РІ РїР°РјСЏС‚Рё Рё СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµС‚СЃСЏ СЃ users/<РЅРёРє>/.
    user: null,       // { nick, key } вЂ” С‚РµРєСѓС‰РёР№ РІРѕС€РµРґС€РёР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ
    loggedIn: false,

    // РїРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕРіРѕ РІС…РѕРґР°: РїСЂРёРјРµРЅРёС‚СЊ СЃС‚Р°С‚РёСЃС‚РёРєСѓ РёР· Р±Р°Р·С‹
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
    // РїРµСЂРµСЂРёСЃРѕРІР°С‚СЊ СЃС‚Р°С‚РёСЃС‚РёРєСѓ РёР· state
    renderStats() {
      document.getElementById('statGames').textContent = state.games;
      document.getElementById('statGains').textContent = fmt(state.gains);
      document.getElementById('statMax').textContent = fmt(state.maxWin);
      document.getElementById('statLuck').textContent = state.luck + '%';
    },
    // РѕР±РЅРѕРІРёС‚СЊ РІРµСЂС…РЅРёР№ Р±Р°Р»Р°РЅСЃ
    refreshUI() {
      let el = document.getElementById('balance');
      if (el) el.textContent = fmt(state.balance);
      let who = document.getElementById('whoAmI');
      if (who) who.textContent = PC.loggedIn ? 'рџЌє ' + PC.user : 'РіРѕСЃС‚СЊ';
    },
    // Р·Р°РїРёСЃР°С‚СЊ РІСЃСЋ СЃС‚Р°С‚РёСЃС‚РёРєСѓ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ RTDB
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
    // РІС‹Р№С‚Рё РёР· Р°РєРєР°СѓРЅС‚Р°
    logout() {
      PC.user = null;
      PC.loggedIn = false;
      // СЃР±СЂРѕСЃ Р»РѕРєР°Р»СЊРЅРѕР№ СЃС‚Р°С‚РёСЃС‚РёРєРё
      for (const k of ['balance','gains','games','maxWin','luck','hidden']) state[k] = k === 'hidden' ? false : 0;
      PC.refreshUI();
    },
    /* ============ Р“Р›РђР’РќРђРЇ РљРќРћРџРљРђ (РґРµР№СЃС‚РІРёРµ РІ РјРѕРґР°Р»РєРµ) ============ */
    mainAction: null, // { label, fn }
    setMain(label, fn) {
      PC.mainAction = { label, fn };
      const b = document.getElementById('playBtn');
      if (b) b.textContent = label;
    },
    takeMain() { // РІС‹Р·РІР°С‚СЊ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРЅРѕРµ РґРµР№СЃС‚РІРёРµ Рё СЃР±СЂРѕСЃРёС‚СЊ
      if (PC.mainAction && PC.mainAction.fn) PC.mainAction.fn();
    },
    debounce(fn, ms) {
      let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    },
  };
})();
PC.games = PC.games || {}; // СЂРµРіРёСЃС‚СЂ РёРіСЂ (РєР°Р¶РґР°СЏ РёРіСЂР° РїРёС€РµС‚ СЃСЋРґР°)