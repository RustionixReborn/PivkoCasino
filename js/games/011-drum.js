/* ============ ИГРА: БАРАБАН ФОРТУНЫ ============ */
/* Казино-механика: взвешенная рулетка. Сектора разной площади.
   Дом в плюсе: EV ≈ 0.915 (house edge ~8.5%).
   Большой куш ×20 — всего 1% площади. 60% — нули. */
PC.games.drum = {
  id: 'drum', name: 'Барабан фортуны', emoji: '🥁',
  cat: 'chance', free: false, minBet: 250, maxMult: 20,
  bets: [250, 500, 1000, 2000, 5000],
  desc: 'Крути взвешенное колесо: нулей тут больше, чем трезвых вечеров. Но кто-то же ловит ×20?',
  tag: 'Колесо',
  /* сектора: label, mult, weight (share из 100) */
  SECTORS: [
    { label: '×0', mult: 0, w: 60 },
    { label: '×0.5', mult: 0.5, w: 13 },
    { label: '×1', mult: 1, w: 11 },
    { label: '×2', mult: 2, w: 9 },
    { label: '×6', mult: 6, w: 6 },
    { label: '×20', mult: 20, w: 1 },
  ],
  start(el, bet, back) {
    const c = document.createElement('div');
    el.appendChild(c);
    const sectors = this.SECTORS;
    const totalW = sectors.reduce((s, x) => s + x.w, 0);
    // углы (градусы)
    let ang = -90;
    const arcsHTML = sectors.map(s => {
      const sweep = s.w / totalW * 360;
      const a0 = ang, a1 = ang + sweep;
      const x0 = 100 + 92 * Math.cos(a0 * Math.PI / 180), y0 = 100 + 92 * Math.sin(a0 * Math.PI / 180);
      const x1 = 100 + 92 * Math.cos(a1 * Math.PI / 180), y1 = 100 + 92 * Math.sin(a1 * Math.PI / 180);
      const mid = (a0 + a1) / 2;
      const mx = 100 + 58 * Math.cos(mid * Math.PI / 180), my = 100 + 58 * Math.sin(mid * Math.PI / 180);
      const large = sweep > 180 ? 1 : 0;
      const color = s.mult === 0 ? '#3a1540' : s.mult >= 6 ? '#5b2a8a' : s.mult >= 2 ? '#4a1f6e' : '#3a1d6e';
      const txt = s.mult === 0 ? '0' : (s.mult + '×');
      const fontSize = sweep > 60 ? 15 : 12;
      ang = a1;
      return `<path d="M100,100 L${x0.toFixed(1)},${y0.toFixed(1)} A92,92 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${color}" stroke="#a06bff" stroke-width="1"/>` +
             `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" fill="${s.mult >= 6 ? '#ffcf5e' : '#fff'}" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${txt}</text>`;
    }).join('');

    let html = `
      <div class="hint" id="drumHint">Ставка <b>${PC.fmt(bet)}</b>. Крути — стрелка решит судьбу.</div>
      <div style="display:flex;justify-content:center;margin:6px 0">
        <div style="position:relative">
          <svg width="230" height="230" viewBox="0 0 200 200" id="drumSvg" style="display:block">
            ${arcsHTML}
          </svg>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-112%);font-size:26px;filter:drop-shadow(0 2px 4px #000)">👇</div>
        </div>
      </div>
      <div id="drumFinal" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"></div>
    `;
    c.innerHTML = html;
    const svg = c.querySelector('#drumSvg');
    const hintEl = c.querySelector('#drumHint');
    let spinning = false;
    let firstPaid = true; // первая прокрутка уже оплачена на экране ставки

    // выбор победившего сектора по весам
    function pickSector() {
      let r = Math.random() * totalW;
      for (const s of sectors) { if (r < s.w) return s; r -= s.w; }
      return sectors[0];
    }
    function spin() {
      if (spinning) return;
      if (firstPaid) {
        firstPaid = false; // ставка уже списана в startGame — не списывать дважды
      } else {
        if (PC.state.balance < bet) { PC.toast('Не хватает рублей.', 'bad'); return; }
        PC.dec(bet);
      }
      PC.click();
      spinning = true;
      svg.style.transition = 'none';
      svg.style.transform = 'rotate(0deg)';
      void svg.offsetWidth;
      // перевести вес победителя в угол от стартовой позиции
      let targetAng = -90;
      const win = pickSector();
      // сектор победителя — попадаем стрелкой (сверху) в его середину
      let cum = 0;
      for (const s of sectors) { if (s === win) { targetAng = cum + s.w / totalW * 360 / 2; break; } cum += s.w / totalW * 360; }
      const offset = 0; // стрелка наверху = угол 90°
      const finalRot = 360 * (6 + Math.floor(Math.random() * 4)) + targetAng + 90;
      svg.style.transition = 'transform 4.2s cubic-bezier(.18,.7,.2,1)';
      svg.style.transform = `rotate(${finalRot}deg)`;
      setTimeout(() => {
        spinning = false;
        const s = win;
        const gross = Math.round(bet * s.mult); // полная выплата
        const net = gross - bet;                // чистыми (отображение)
        // ставка уже списана при старте/переходе — начисляем ПОЛНЫЙ gross
        PC.balance(gross);
        if (net > 0) { PC.win(); if (s.mult >= 6) PC.confetti(); } else PC.lose();
        PC.played();
        const msg = s.mult === 0
          ? '0. Нулевой сектор. Дом доволен. ' + PC.randJoke()
          : (net > 0 ? '🎉 ' : '🙂 ') + 'Выпало ×' + s.mult + ': ' + (net >= 0 ? '+' : '') + PC.fmt(net) + ' ₽.';
        PC.toast(msg, net > 0 ? (s.mult >= 6 ? 'gold' : 'good') : 'bad');
        hintEl.textContent = net > 0 ? 'Повезло: +' + PC.fmt(net) + ' ₽ чистых.' : (s.mult === 0 ? 'Нуль. ' + PC.randJoke() : 'Дом снова в плюсе.');
        showFinal();
      }, 4400);
    }
    function showFinal() {
      const wrap = c.querySelector('#drumFinal');
      wrap.innerHTML = '';
      const a = document.createElement('button');
      a.className = 'game-btn btn-primary';
      a.textContent = '🥁 Крутить ещё (' + PC.fmt(bet) + ')';
      a.onclick = () => { PC.click(); spin(); };
      const b = document.createElement('button');
      b.className = 'game-btn btn-ghost';
      b.textContent = '⬅ К ставкам';
      b.onclick = () => back();
      wrap.appendChild(a); wrap.appendChild(b);
    }
    svg.addEventListener('click', () => { if (!spinning) spin(); });
    showFinal();
  }
};