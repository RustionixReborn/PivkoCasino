/* ============ ИГРА: БАРАБАН ФОРТУНЫ ============ */
/* Рулетка: сектора РАВНЫЕ визуально (честное колесо), но победитель
   выбирается по ВЕСАМ — ×0 реально выпадает чаще, ×20 — редко.
   Дом в плюсе: EV ≈ 0.915 (house edge ~8.5%). */
PC.games.drum = {
  id: 'drum', name: 'Барабан фортуны', emoji: '🥁',
  cat: 'chance', free: false, minBet: 250, maxMult: 20,
  bets: [250, 500, 1000, 2000, 5000],
  desc: 'Крути колесо. Деления честные, а вот удача — на стороне дома. Но кто-то же ловит ×20?',
  tag: 'Колесо',
  /* сектора: label, mult, weight. Визуально равны, шанс — по weight */
  SECTORS: [
    { label: '0',    mult: 0,   w: 60 },
    { label: '×0.5', mult: 0.5, w: 13 },
    { label: '×1',   mult: 1,   w: 11 },
    { label: '×2',   mult: 2,   w: 9 },
    { label: '×6',   mult: 6,   w: 6 },
    { label: '×20',  mult: 20,  w: 1 },
  ],
  start(el, bet, back) {
    const c = document.createElement('div');
    el.appendChild(c);
    const sectors = this.SECTORS;
    const totalW = sectors.reduce((s, x) => s + x.w, 0);
    const N = sectors.length;
    const sweep = 360 / N; // равные деления (60°)

    // строим N РАВНЫХ секторов (шансы фактически разные — по весам)
    const arcsHTML = sectors.map((s, i) => {
      const a0 = -90 + i * sweep;
      const a1 = a0 + sweep;
      const x0 = 100 + 92 * Math.cos(a0 * Math.PI / 180), y0 = 100 + 92 * Math.sin(a0 * Math.PI / 180);
      const x1 = 100 + 92 * Math.cos(a1 * Math.PI / 180), y1 = 100 + 92 * Math.sin(a1 * Math.PI / 180);
      const mid = (a0 + a1) / 2;
      const mx = 100 + 58 * Math.cos(mid * Math.PI / 180), my = 100 + 58 * Math.sin(mid * Math.PI / 180);
      const color = s.mult === 0 ? '#3a1540' : s.mult >= 6 ? '#5b2a8a' : s.mult >= 2 ? '#4a1f6e' : '#3a1d6e';
      const txt = s.mult === 0 ? '0' : (s.mult + '×');
      return `<path d="M100,100 L${x0.toFixed(1)},${y0.toFixed(1)} A92,92 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${color}" stroke="#a06bff" stroke-width="1"/>` +
             `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" fill="${s.mult >= 6 ? '#ffcf5e' : '#fff'}" font-size="13" font-weight="700" text-anchor="middle" dominant-baseline="middle">${txt}</text>`;
    }).join('');

    let html = `
      <div class="hint" id="drumHint">Ставка <b>${PC.fmt(bet)}</b>. Крути — стрелка решит судьбу.</div>
      <div style="display:flex;justify-content:center;margin:14px 0 6px">
        <div style="position:relative;padding-top:26px">
          <svg width="230" height="230" viewBox="0 0 200 200" id="drumSvg" style="display:block">
            ${arcsHTML}
          </svg>
          <!-- фиксированный указатель сверху (не вращается вместе с колесом) -->
          <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:5;filter:drop-shadow(0 2px 3px rgba(0,0,0,.8))">
            <svg width="30" height="34" viewBox="0 0 30 34">
              <path d="M15 33 L4 12 Q15 2 26 12 Z" fill="#ff5b5b" stroke="#7a0012" stroke-width="1.5"/>
            </svg>
          </div>
        </div>
      </div>
      <div id="drumFinal" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"></div>
    `;
    c.innerHTML = html;
    const svg = c.querySelector('#drumSvg');
    const hintEl = c.querySelector('#drumHint');
    let spinning = false;
    let firstPaid = true; // первая прокрутка уже оплачена на экране ставки

    // выбор победившего сектора ПО ВЕСАМ (визуальная честность — обманка)
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
      const win = pickSector();
      const wi = sectors.indexOf(win);
      // центр сектора-победителя (в screen-координатах y вниз, -90° = верх/12ч)
      // центр сектора i: -90 + i*60 + 30 = i*60 - 60
      const center = wi * sweep - 60;
      // нужный поворот, чтобы центр сектора встал под указатель (верх = 270°):
      // 270 - center = 270 - (i*60-60) = 330 - i*60
      let offset = 330 - wi * sweep;
      offset = ((offset % 360) + 360) % 360;
      const spins = 8 + Math.floor(Math.random() * 4); // много полных оборотов, похоже на честное колесо
      const finalRot = 360 * spins + offset;

      svg.style.transition = 'none';
      svg.style.transform = 'rotate(0deg)';
      void svg.offsetWidth;
      svg.style.transition = 'transform 4.2s cubic-bezier(.18,.7,.2,1)';
      svg.style.transform = `rotate(${finalRot}deg)`;
      setTimeout(() => {
        spinning = false;
        const s = win;
        const gross = Math.round(bet * s.mult);
        const net = gross - bet;
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