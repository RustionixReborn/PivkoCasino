/* ============ ИГРА: ПИВНОЙ РУДНИК ============ */
PC.games.mine = {
  id: 'mine', name: 'Пивной рудник', emoji: '⛏️',
  cat: 'risk', free: false, minBet: 250, maxMult: 95,
  bets: [250, 500, 1000, 2000],
  desc: 'Копай ячейки. Каждая безопасная — множитель растёт. Но под тремя капсулами — бомбы. Забери куш, пока не взорвалось.',
  tag: 'Риск',
  /* множитель после k безопасных клеток (постепенно, дом забирает своё) */
  MULT: { 1:1.1, 2:1.3, 3:1.6, 4:2.0, 5:2.6, 6:3.4, 7:4.6, 8:6.5, 9:9.5, 10:15, 11:25, 12:45, 13:95 },
  start(el, bet, back) {
    const container = document.createElement('div');
    el.appendChild(container);

    let bombs, mult = 1, opened = 0, playing = false;
    const CELLS = 16, BOMBS = 3;

    let html = `
      <div class="hint" id="mineHint">Ставка <b>${PC.fmt(bet)}</b>. Копай бочки ⛏️, избегай бомб 💣.</div>
      <div class="grid4" id="mineGrid"></div>
      <div class="hint" id="mineWin" style="font-weight:700;color:var(--gold)">Множитель: ×1 (забрать = 0 ₽)</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="game-btn btn-primary" id="mineCash">💰 Забрать</button>
        <button class="game-btn btn-ghost" id="mineBack">⬅ К ставкам</button>
      </div>
    `;
    container.innerHTML = html;
    const hint = container.querySelector('#mineHint');
    const gridEl = container.querySelector('#mineGrid');
    const winEl = container.querySelector('#mineWin');
    const cashBtn = container.querySelector('#mineCash');
    container.querySelector('#mineBack').onclick = () => back();

    function startRound() {
      bombs = new Set();
      while (bombs.size < BOMBS) bombs.add(Math.floor(Math.random() * CELLS));
      mult = 1; opened = 0; playing = true;
      winEl.textContent = 'Множитель: ×1 (забрать = 0 ₽)';
      hint.textContent = 'Копай! Нашёл бочку — множитель растёт. Бомба — всё пропало.';
      gridEl.innerHTML = '';
      for (let i = 0; i < CELLS; i++) {
        const c = document.createElement('div');
        c.className = 'cell'; c.style.fontSize = '22px'; c.style.cursor = 'pointer';
        c.onclick = () => dig(c, i);
        gridEl.appendChild(c);
      }
    }
    function dig(c, idx) {
      if (!playing || c.classList.contains('open')) return;
      PC.click();
      c.classList.add('open');
      if (bombs.has(idx)) {
        // взрыв — показываем все бомбы
        gridEl.querySelectorAll('.cell').forEach((x, i) => { if (bombs.has(i) && !x.classList.contains('lose')) x.textContent = '💣'; });
        c.classList.add('lose');
        playing = false;
        PC.lose();
        PC.played();
        winEl.textContent = '💥 Бум! Ты потерял ' + PC.fmt(bet) + ' ₽.';
        PC.toast('💣 Взрыв! ' + PC.randJoke(), 'bad');
        setTimeout(() => back(), 1800);
      } else {
        c.textContent = '🍺';
        c.classList.add('win');
        opened++;
        mult = PC.games.mine.MULT[opened] || mult;
        const current = Math.round(bet * mult);
        winEl.textContent = `Множитель: ×${mult} (забрать = ${PC.fmt(current)})`;
        PC.win();
        if (opened === CELLS - BOMBS) cashout(true);
      }
    }
    function cashout(auto) {
      if (!playing) return;
      playing = false;
      const w = Math.round(bet * mult);
      PC.balance(w); PC.played();
      PC.confetti();
      PC.toast('💰 Забрал ' + PC.fmt(w) + ' ₽! (ставка вычтена)' + (auto ? ' Все бочки найдены!' : ''), 'gold');
      winEl.textContent = '🎉 +' + PC.fmt(w) + ' ₽!';
      setTimeout(() => back(), 1800);
    }
    cashBtn.onclick = () => cashout(false);
    startRound();
  }
};