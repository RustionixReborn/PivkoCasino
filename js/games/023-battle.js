/* ============ ИГРА: БАТТЛ (PvP с другом) ============ */
/* Дуэль: оба друга ставят (можно разные суммы). Рулетка = 10 клеток,
   пропорция клеток = отношение ставок. Победитель забирает весь банк.
   P2P через RTDB: каждый пишет только свой баланс (через battleSettle). */
(() => {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt = (n) => (typeof PC !== 'undefined' && PC.fmt) ? PC.fmt(n) : String(n);
  const nickCache = {}; // uid -> nick (кэш, чтобы поллинг не тряс окно и не спамил запросами)
  async function friendNick(uid) {
    if (nickCache[uid]) return nickCache[uid];
    try { const lb = await FB.listLeaderboard(); const d = lb[uid]; nickCache[uid] = (d && d.nick) || uid.slice(0, 8); }
    catch (e) { nickCache[uid] = uid.slice(0, 8); }
    return nickCache[uid];
  }
  function myUid() { return (FB && FB.myUid) ? FB.myUid() : null; }

  PC.games.battle = {
    id: 'battle', name: 'Баттл', emoji: '⚔️',
    cat: 'pvp', free: false, minBet: 1500, maxMult: 'банк',
    bets: [1500, 2000, 5000, 10000],
    desc: 'Дуэль с другом: оба ставите (можно разные суммы), рулетка на 10 клеток. Кто больше поставил — у того больше клеток и шансов. Победитель забирает весь банк!',
    tag: 'PvP',
    start(el, bet, back) {
      let pollTimer = null;
      let roomTimer = null;
      let destroyed = false;

      function destroy() {
        destroyed = true;
        if (pollTimer) clearInterval(pollTimer);
        if (roomTimer) clearInterval(roomTimer);
      }

      // ====== ГЛАВНОЕ МЕНЮ БАТТЛА ======
      function render() {
        el.innerHTML = `
          <div class="battle-main">
            <div class="hint">⚔️ Вызови друга на дуэль или прими вызов. Банк забирает победитель!</div>
            <div class="battle-sec"><div class="battle-col-title">📥 Входящие вызовы</div><div id="btIn" class="bt-rows"></div></div>
            <div class="battle-sec"><div class="battle-col-title">✉️ Мои вызовы</div><div id="btOut" class="bt-rows"></div></div>
            <div class="battle-sec"><div class="battle-col-title">👥 Друзья</div><div id="btFriends" class="bt-rows"></div></div>
          </div>
        `;
        // чек активных комнат (меня могут вызвать/я вызвал → друг принял)
        checkActiveRooms();
        loadIn(); loadOut(); loadFriends();
        if (pollTimer) clearInterval(pollTimer);
        // обновляем ВСЕ секции, чтобы вызовы исчезали у обеих сторон после принятия
        pollTimer = setInterval(() => { if (!destroyed) { loadIn(); loadOut(); loadFriends(); checkActiveRooms(); } }, 3500);
      }

      // ====== ВХОДЯЩИЕ ======
      // перерисовываем секцию ТОЛЬКО если набор/содержимое изменились (иначе окно прыгает от поллинга)
      function patch(box, sig, build) {
        if (box.__sig === sig) return;
        box.__sig = sig;
        box.innerHTML = '';
        build(box);
      }
      // предзагрузить ники в кэш (асинхронно, без блокировки)
      function prefetchNicks(uids) {
        let miss = false;
        for (const uid of uids) if (!nickCache[uid]) { miss = true; break; }
        if (miss) Promise.all(uids.map(friendNick)).then(() => { /* след. поллинг сам отрисует с никами */ });
      }
      async function loadIn() {
        const box = el.querySelector('#btIn');
        if (!box) return;
        try {
          const list = await FB.battleIncomingDetail();
          if (!list.length) { patch(box, 'empty', b => { b.innerHTML = '<div class="hint">Нет вызовов.</div>'; }); return; }
          prefetchNicks(list.map(x => x.uid));
          // сигнатура включает ники: когда они догрузятся — отрисовка обновится ОДИН раз
          const sig = list.map(x => x.uid + ':' + x.bet + ':' + (nickCache[x.uid] || '?')).join('|');
          patch(box, sig, (b) => {
            for (const it of list) {
              const nick = nickCache[it.uid] || it.uid.slice(0, 6);
              const row = document.createElement('div');
              row.className = 'fr-row';
              row.innerHTML = `<div class="fr-info"><div class="fr-nick">⚔️ ${esc(nick)}</div><div class="fr-stats">ставит ${fmt(it.bet)} ₽</div></div>
                <button class="btn btn-primary fr-a" data-a="1">Играть</button>
                <button class="btn btn-ghost fr-a" data-d="1">Отказ</button>`;
              row.querySelector('[data-a]').onclick = () => acceptInvite(it.uid);
              row.querySelector('[data-d]').onclick = async () => { try { await FB.battleDecline(it.uid); } catch (_) {} loadIn(); };
              b.appendChild(row);
            }
          });
        } catch (e) { patch(box, 'err:' + e.message, b => { b.innerHTML = '<div class="hint">' + esc(e.message) + '</div>'; }); }
      }

      // диалог выбора ставки (для принимающего и вызывающего)
      function askBetDialog(title, presets, prefill) {
        return new Promise(res => {
          const askBalance = () => (typeof PC !== 'undefined' && PC.state ? PC.state.balance : 0);
          const w = document.createElement('div');
          w.className = 'battle-ask-wrap';
          w.innerHTML = `
            <div class="battle-ask">
              <div class="battle-ask-title">${esc(title)}</div>
              <div class="bet-amounts" id="btABets" style="justify-content:center"></div>
              <div style="font-size:12px;color:var(--mut);margin:8px 2px">У тебя на руках: <b>${fmt(askBalance())} ₽</b></div>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="number" id="btABet" class="bet-input" min="1500" placeholder="свой размер" style="flex:1">
                <button class="btn btn-primary" id="btAVa" title="Весь баланс">🔥 ВА-БАНК</button>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn btn-primary" id="btAOk" style="flex:1">⚔️ В бой!</button>
                <button class="btn btn-ghost" id="btANo">Отмена</button>
              </div>
            </div>
          `;
          el.appendChild(w);
          const wrap = w.querySelector('#btABets');
          const inp = w.querySelector('#btABet');
          inp.value = prefill;
          // ВА-БАНК: весь баланс (валидная ставка от 1500)
          w.querySelector('#btAVa').onclick = () => {
            const whole = askBalance();
            inp.value = whole;
            wrap.querySelectorAll('.bet-option').forEach(x => x.classList.remove('active'));
            PC.click && PC.click();
            PC.toast && PC.toast(whole < 1500 ? 'Не хватает даже на минимум (1500 ₽)' : 'ВА-БАНК: ' + fmt(whole) + ' ₽', whole < 1500 ? 'bad' : 'gold');
          };
          presets.forEach(b => {
            const o = document.createElement('button');
            o.className = 'bet-option' + (b === prefill ? ' active' : '');
            o.textContent = fmt(b);
            o.onclick = () => { wrap.querySelectorAll('.bet-option').forEach(x => x.classList.remove('active')); o.classList.add('active'); inp.value = b; };
            wrap.appendChild(o);
          });
          w.querySelector('#btANo').onclick = () => { w.remove(); res(null); };
          w.querySelector('#btAOk').onclick = () => { const v = parseInt(inp.value, 10); w.remove(); res(v > 0 ? v : null); };
        });
      }

      // ====== B принимает вызов ======
      async function acceptInvite(fromUid) {
        try {
          const inv = await FB.get('battles/inc/' + encodeURIComponent(myUid()) + '/' + encodeURIComponent(fromUid));
          if (!inv) { PC.toast('Вызов исчез', 'bad'); loadIn(); return; }
          const aBet = inv.bet || 1500;
          const myBet = await askBetDialog('Соперник ставит ' + fmt(aBet) + ' ₽. Твоя ставка:', [1500, 2000, 5000, 10000], Math.max(1500, PC.state.balance >= 5000 ? 2000 : 1500));
          if (!myBet || myBet < 1500) { PC.toast('Ставка от 1500 ₽', 'bad'); return; }
          if (PC.state.balance < myBet) { PC.toast('Не хватает рублей', 'bad'); return; }
          const rid = await FB.battleAccept(fromUid, myBet);
          enterRoom(rid);
        } catch (e) { PC.toast(e.message, 'bad'); }
      }

      // ====== A вызывает друга ======
      async function challengeFriend(uid, nick) {
        try {
          const myBet = await askBetDialog('Твоя ставка в дуэли с ' + esc(nick) + ':', [1500, 2000, 5000, 10000], Math.max(1500, PC.state.balance >= 5000 ? 2000 : 1500));
          if (!myBet || myBet < 1500) return;
          if (PC.state.balance < myBet) { PC.toast('Не хватает рублей', 'bad'); return; }
          await FB.battleSend(uid, myBet);
          PC.toast('⚔️ Вызов отправлен ' + nick + '!', 'gold');
          loadOut();
        } catch (e) { PC.toast(e.message, 'bad'); }
      }

      // ====== МОИ ВЫЗОВЫ ======
      async function loadOut() {
        const box = el.querySelector('#btOut');
        if (!box) return;
        try {
          const uids = await FB.battleOutgoing();
          if (!uids.length) { patch(box, 'empty', b => { b.innerHTML = '<div class="hint">Нет вызовов.</div>'; }); return; }
          prefetchNicks(uids);
          const sig = uids.map(u => u + ':' + (nickCache[u] || '?')).join('|');
          patch(box, sig, (b) => {
            for (const uid of uids) {
              const nick = nickCache[uid] || uid.slice(0, 6);
              const row = document.createElement('div');
              row.className = 'fr-row';
              row.innerHTML = `<div class="fr-info"><div class="fr-nick">⚔️ ${esc(nick)}</div><div class="fr-stats">ждёт ответа</div></div>
                <button class="btn btn-danger fr-a" data-c="1">Отменить</button>`;
              row.querySelector('[data-c]').onclick = async () => { try { await FB.battleCancel(uid); } catch (_) {} loadOut(); };
              b.appendChild(row);
            }
          });
        } catch (e) { patch(box, 'err:' + e.message, b => { b.innerHTML = '<div class="hint">' + esc(e.message) + '</div>'; }); }
      }

      // ====== ДРУЗЬЯ ======
      async function loadFriends() {
        const box = el.querySelector('#btFriends');
        if (!box) return;
        try {
          const uids = await FB.friendList('list');
          if (!uids.length) { patch(box, 'empty', b => { b.innerHTML = '<div class="hint">Нет друзей — добавь во вкладке «Друзья».</div>'; }); return; }
          // кто уже вызван мной + кто вызвал меня + с кем идёт катка
          const [sentUids, inList] = await Promise.all([FB.battleOutgoing(), FB.battleIncoming()]);
          const activeUids = new Set();
          try {
            const rids = await FB.battleAcc();
            for (const rid of rids) {
              const room = await FB.battleGetRoom(rid);
              if (room && (room.state === 'countdown' || room.state === 'spinning')) {
                const other = room.a === myUid() ? room.b : room.a;
                activeUids.add(other);
              }
            }
          } catch (_) {}
          prefetchNicks(uids);
          // статус друга → подпись (перерисовка только при РЕАЛЬНОМ изменении)
          const statusOf = (uid) => activeUids.has(uid) ? 'fight' : sentUids.includes(uid) ? 'sent' : inList.includes(uid) ? 'inv' : 'free';
          const sig = uids.map(u => u + ':' + statusOf(u) + ':' + (nickCache[u] || '?')).join('|');
          if (box.__sig === sig) return;
          box.__sig = sig;
          box.innerHTML = '';
          for (const uid of uids) {
            const nick = nickCache[uid] || uid.slice(0, 6);
            const stt = statusOf(uid);
            const row = document.createElement('div');
            row.className = 'fr-row';
            let action = '', stats = 'друг';
            if (stt === 'fight') { stats = 'вы уже в бою!'; action = '<span class="fr-wait">⚔️ в бою</span>'; }
            else if (stt === 'sent') { stats = 'вызов отправлен, ждёт ответа'; action = '<span class="fr-wait">⏳ вызвано</span>'; }
            else if (stt === 'inv') { stats = 'он вызвал тебя — прими выше!'; action = '<span class="fr-wait">📥 вызвал тебя</span>'; }
            else { action = '<button class="btn btn-primary fr-a" data-ch="1">Вызвать</button>'; }
            row.innerHTML = `<div class="fr-info"><div class="fr-nick">⚔️ ${esc(nick)}</div><div class="fr-stats">${esc(stats)}</div></div>${action}`;
            const ch = row.querySelector('[data-ch]');
            if (ch) ch.onclick = () => challengeFriend(uid, nick);
            box.appendChild(row);
          }
        } catch (e) { box.innerHTML = '<div class="hint">' + esc(e.message) + '</div>'; }
      }

      // ====== АКТИВНЫЕ КОМНАТЫ (быть в бою, когда друг принял вызов) ======
      // Комнаты живут максимум ~40 сек (3 сек countdown + рулетка); дольше — «мёртвая» (соперник ушёл).
      const ROOM_TTL_MS = 40000;
      async function checkActiveRooms() {
        if (destroyed) return;
        try {
          const rids = await FB.battleAcc();
          for (const rid of rids) {
            const room = await FB.battleGetRoom(rid);
            if (!room) { try { await FB.battleClean(rid); } catch (_) {} continue; }
            const age = Date.now() - (room.startAt || 0);
            const stale = room.state === 'countdown' || room.state === 'spinning' ? age > ROOM_TTL_MS : false;
            // открываем только ЖИВУЮ комнату (недавняя, ещё не закончена)
            if ((room.state === 'countdown' || room.state === 'spinning') && !stale) {
              if (room.a === myUid() || room.b === myUid()) { enterRoom(rid); return; }
            }
            // мёртвая (done) или «протухшая» (соперник ушёл) — чистим реестр, чтобы не блокировала
            if (!stale && room.state === 'done') { /* разыгранная — чистим */ }
            try { await FB.battleClean(rid); } catch (_) {}
          }
        } catch (_) {}
      }

      // ====== ВХОД В КОМНАТУ ======
      async function enterRoom(rid) {
        // НЕ destroy(): иначе countdown/runSpin увидели destroyed=true и встали.
        // Просто выключаем поллинг лобби, оставляем баттл «живым».
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        el.innerHTML = '';
        const room = await FB.battleGetRoom(rid);
        if (!room) { render(); return; }
        // снимаем СВОЙ исходящий вызов (отправитель чистит свой out сам; чужой удалять нельзя)
        await FB.battleClearOwnOut(rid).catch(() => {});
        const me = myUid();
        const amI = room.a === me;
        const myBet = amI ? room.aBet : room.bBet;
        const foeBet = amI ? room.bBet : room.aBet;
        const foeUid = amI ? room.b : room.a;
        const myColor = amI ? room.aColor : room.bColor;
        const foeColor = amI ? room.bColor : room.aColor;

        // рендер комнаты: банк, оба цвета, рулетка
        el.innerHTML = `
          <div class="battle-room">
            <div class="hint" id="btStatus">Комната создана…</div>
            <div class="battle-bank">БАНК: <b id="btBank">0</b></div>
            <div class="battle-players">
              <div class="battle-p" id="btMe"><div class="btp-color" id="btMeColor"></div><div class="btp-nick" id="btMeNick">ты</div><div class="btp-bet" id="btMeBet">0</div></div>
              <div class="battle-vs">VS</div>
              <div class="battle-p" id="btFoe"><div class="btp-color" id="btFoeColor"></div><div class="btp-nick" id="btFoeNick">соперник</div><div class="btp-bet" id="btFoeBet">0</div></div>
            </div>
            <div class="battle-wheel" id="btWheel"></div>
            <div id="btResult" class="battle-result"></div>
          </div>
        `;
        // заполняем данные
        const foeNick = await friendNick(foeUid);
        const bank = room.aBet + room.bBet;
        el.querySelector('#btBank').textContent = fmt(bank);
        el.querySelector('#btMeNick').textContent = amI ? (room.aNick || 'ты') : (room.bNick || 'ты');
        el.querySelector('#btMeBet').textContent = fmt(myBet) + ' ₽';
        el.querySelector('#btMeColor').style.background = myColor;
        el.querySelector('#btMeNick').textContent += amI ? ' (ты)' : '';
        el.querySelector('#btFoeNick').textContent = foeNick;
        el.querySelector('#btFoeBet').textContent = fmt(foeBet) + ' ₽';
        el.querySelector('#btFoeColor').style.background = foeColor;
        // цветовая полоса противника не видна если hidden — лучше текстом
        el.querySelector('#btFoeNick').textContent = foeNick + ' · ' + (foeColor === '#3d8bff' ? '🔵' : '🔴');

        // количество клеток (из result уже готово, или посчитаем)
        const total = room.aBet + room.bBet;
        const aCells = Math.max(1, Math.min(9, Math.round(10 * room.aBet / total)));
        const bCells = 10 - aCells;

        // строим маленькую мини-рулетку (полоска из 10 клеток)
        drawWheel(aCells, bCells);

        const st = el.querySelector('#btStatus');
        if (room.state === 'countdown') {
          // countdown по АБСОЛЮТНОМУ времени комнаты — одинаково у обоих и не «застревает»
          const deadline = (room.startAt || Date.now()) + 4000;
          const tick = () => {
            if (destroyed) return;
            const left = Math.ceil((deadline - Date.now()) / 1000);
            const box = el.querySelector('#btStatus');
            if (!box) return;
            if (left <= 0) {
              box.textContent = '🎲 Рулетка крутится…';
              runSpin(rid, aCells, bCells);
            } else {
              box.textContent = '🕒 Старт через ' + left + '…';
              setTimeout(tick, 250);
            }
          };
          tick();
        } else if (room.state === 'spinning' || room.state === 'done') {
          st.textContent = room.state === 'done' ? '🏁 Итоги:' : '🎲 Рулетка крутится…';
          runSpin(rid, aCells, bCells);
        }
      }

      // отрисовка полосы-рулетки (10 клеток — упрощённо, символы)
      function drawWheel(aCells) {
        const wheel = el.querySelector('#btWheel');
        if (!wheel) return;
        wheel.innerHTML = 'Клетки (синие vs красные): ';
        for (let i = 0; i < aCells; i++) wheel.innerHTML += '<span class="bt-cell bt-blue">■</span>';
        for (let i = aCells; i < 10; i++) wheel.innerHTML += '<span class="bt-cell bt-red">■</span>';
      }

      // запустить рулетку (детерминированный результат из комнаты)
      async function runSpin(rid, aCells) {
        if (destroyed) return;
        try {
          const room = await FB.battleResolve(rid);
          if (!room || !room.result) return;
          const r = room.result;
          const me = myUid();
          // применить деньги (идемпотентно)
          await FB.battleSettle(rid).catch(() => {});
          // почистить реестр именно ЭТОЙ комнаты — чтобы не открывалась заново и не блокировала новую игру
          await FB.battleClean(rid).catch(() => {});
          if (window.PC && PC.refreshUI) PC.refreshUI();
          const resultBox = el.querySelector('#btResult');
          const st = el.querySelector('#btStatus');
          if (!resultBox) return;
          const iWon = r.winner === me;
          const bank = room.aBet + room.bBet;
          resultBox.innerHTML = `
            <div class="battle-winner">${iWon ? '🏆 ТЫ ПОБЕДИЛ! +' + fmt(bank) + ' ₽' : '💔 Победил соперник. −' + fmt(iWon ? 0 : (me === room.a ? room.aBet : room.bBet)) + ' ₽'}</div>
          `;
          if (st) st.textContent = '🏁 Итоги:';
          if (iWon && PC.confetti) PC.confetti();
          // кнопка выхода → назад в ЛОББИ баттла (не в экран ставки)
          resultBox.innerHTML += '<button class="btn btn-primary" id="btDone" style="margin-top:12px">⬅ В лобби</button>';
          el.querySelector('#btDone').onclick = () => backToLobby();
        } catch (e) { console.warn('spin', e); }
      }

      // вернуться в лобби баттла
      function backToLobby() {
        destroy();
        pollTimer = null;
        enterLobbyMode();
      }
      // перезапустить лобби (используется как back при выходе из комнаты)
      function enterLobbyMode() {
        render();
      }

      render();
      el.__destroy = destroy;
      el.__back = backToLobby;
    },
  };
})();