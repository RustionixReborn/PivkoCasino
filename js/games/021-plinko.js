/* ============ ИГРА: ПИВНОЙ ПЛОНКО ============ */
/* Казино-механика: каждый шарик стоит ставку (мин. 500 ₽).
   Множители РАЗБРОСАНЫ неравномерно (0.5× по краям, джекпот 144× где-то снаружи),
   но подобраны так, что мат. ожидание ≈ 0.90 — дом всегда в плюсе.
   Слоты и шарик нарисованы трапециями. */
PC.games.plinko = {
  id: 'plinko', name: 'Пивной Плонко', emoji: '🔻',
  cat: 'chance', free: false, minBet: 500, maxMult: 144,
  bets: [500, 1000, 2000, 5000],
  desc: 'Урони шарик в лабиринт гвоздей. Множители разбросаны как попало: где-то 0.5×, где-то 144×. Угадай, куда покатится.',
  tag: 'Шанс',
  JACKPOT: 144,
  start(el, bet, back) {
    const container = document.createElement('div');
    el.appendChild(container);
    container.innerHTML = `
      <div class="hint" id="plinkoHint">Ставка <b>${PC.fmt(bet)}</b> за шарик. Жми на холст или «Уронить».</div>
      <div class="plinko-betbar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px">
        <span class="hint" style="margin:0">Рядов:</span>
        <button class="game-btn btn-ghost pl-rows" data-v="8">8</button>
        <button class="game-btn btn-ghost pl-rows" data-v="12">12</button>
        <button class="game-btn btn-ghost pl-rows active" data-v="16">16</button>
      </div>
      <div style="position:relative">
        <canvas id="plinkoCanvas" style="width:100%;height:420px;display:block;border-radius:16px;background:
          radial-gradient(500px 300px at 20% 10%, rgba(160,107,255,.28), transparent 60%),
          linear-gradient(180deg,#1c0d38,#120726);border:1px solid var(--line)"></canvas>
      </div>
      <div class="plinko-result" id="plinkoResult" style="text-align:center;font-weight:800;font-size:16px;min-height:24px;margin-top:8px"></div>
      <div id="plinkoFinal" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"></div>
    `;

    const canvas = container.querySelector('#plinkoCanvas');
    const ctx = canvas.getContext('2d');
    const hint = container.querySelector('#plinkoHint');
    const resultEl = container.querySelector('#plinkoResult');
    const finalWrap = container.querySelector('#plinkoFinal');
    const JACKPOT = PC.games.plinko.JACKPOT;

    let rows = 16;
    let W = 0, H = 0, DPR = 1;
    let pegs = [], slots = [];
    let ball = null;
    let pegW = 0, pegH = 0;
    let busy = false, raf = null, lastTime = 0;

    /* ---- вероятности биномиального блуждания за `rows` шагов ---- */
    function binomialProbs(n) {
      const probs = new Array(n + 1).fill(0);
      let comb = 1; const pow = Math.pow(2, n);
      for (let k = 0; k <= n; k++) {
        if (k > 0) comb = comb * (n - k + 1) / k;
        probs[k] = comb / pow;
      }
      return probs; // длина n+1 = число колонок
    }

    /* ---- РАЗБРОСАННЫЕ множители через «бюджет вероятностей».
       Вклад колонки = P(колонка) × множитель. Сумма вкладов = EV = 0.90,
       поэтому дом ВСЕГДА в плюсе, какие бы числа ни выпали.
       Низковероятные колонки получают большие множители (144× и т.п.),
       частые — мелкие. Значения перемешаны, края — 0.5×. */
    function multipliers(rowsN) {
      const cols = rowsN + 1;
      const center = (cols - 1) / 2;
      const probs = binomialProbs(rowsN);
      const vals = new Array(cols).fill(0);
      const CAP = 200; // потолок множителя

      // 1) края — всегда 0.5×
      vals[0] = 0.5;
      vals[cols - 1] = 0.5;
      let used = probs[0] * 0.5 + probs[cols - 1] * 0.5;
      let budget = 0.90 - used;

      // 2) джекпот: самая редкая внутренняя колонка (ближе к краю)
      let jpCol = 1;
      for (let c = 1; c < cols - 1; c++) {
        if (probs[c] < probs[jpCol]) jpCol = c;
      }
      const jpBudget = Math.min(budget * 0.45, 0.32);
      // 144× ставим, только если редкость колонки это позволяет
      let jpVal = Math.min(JACKPOT, jpBudget / probs[jpCol]);
      jpVal = Math.round(jpVal * 10) / 10;
      vals[jpCol] = jpVal;
      budget -= probs[jpCol] * jpVal;

      // 3) остальные колонки: случайные доли остатка бюджета
      const rest = [];
      for (let c = 1; c < cols - 1; c++) if (c !== jpCol) rest.push(c);
      const weights = rest.map(() => 0.3 + Math.random());
      const wSum = weights.reduce((a, b) => a + b, 0);
      rest.forEach((c, i) => {
        const share = budget * weights[i] / wSum;
        let v = share / probs[c];
        v = Math.max(0.2, Math.min(CAP, v));
        vals[c] = Math.round(v * 10) / 10;
      });

      // 4) точная доводка EV=0.90 через самую частую колонку
      let tuner = 1, tp = -1;
      for (let c = 1; c < cols - 1; c++) {
        if (c === jpCol) continue;
        if (probs[c] > tp) { tp = probs[c]; tuner = c; }
      }
      let evOthers = 0;
      for (let c = 0; c < cols; c++) if (c !== tuner) evOthers += probs[c] * vals[c];
      let tv = (0.90 - evOthers) / tp;
      if (!isFinite(tv) || tv < 0.1) tv = 0.2;
      if (tv > CAP) tv = CAP;
      vals[tuner] = Math.round(tv * 10) / 10;
      return vals;
    }

    function layout() {
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      pegW = W / (rows + 1);
      pegH = H / (rows + 1.6);
      buildPegs(); buildSlots(); draw();
    }
    function buildPegs() {
      pegs = [];
      const R = Math.max(3, pegW * 0.13);
      for (let r = 1; r <= rows; r++) {
        const cols = r + 1;
        for (let c = 0; c < cols; c++) {
          const x = pegW * (c + 0.5) + (r % 2 === 0 ? pegW / 2 : 0);
          const y = pegH * r;
          pegs.push({ x: Math.min(Math.max(x, 12), W - 12), y, r: R });
        }
      }
    }
    function buildSlots() {
      slots = [];
      const n = rows + 1;
      const mults = multipliers(rows);          // ВЕРНО: передаём число РЯДОВ
      for (let i = 0; i < n; i++) {
        slots.push({ x: (W / n) * (i + 0.5), mult: mults[i], w: W / n });
      }
    }

    /* ---- трапеция: узкий верх, широкий низ ---- */
    function trapezoid(cx, cy, wTop, wBot, h) {
      ctx.beginPath();
      ctx.moveTo(cx - wTop / 2, cy - h / 2);
      ctx.lineTo(cx + wTop / 2, cy - h / 2);
      ctx.lineTo(cx + wBot / 2, cy + h / 2);
      ctx.lineTo(cx - wBot / 2, cy + h / 2);
      ctx.closePath();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // гвоздики
      pegs.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200,170,255,.85)';
        ctx.shadowColor = 'rgba(160,107,255,.8)'; ctx.shadowBlur = 8;
        ctx.fill(); ctx.shadowBlur = 0;
      });
      // слоты-трапеции
      slots.forEach(s => {
        const jp = s.mult >= 50;
        const hot = s.mult >= 5;
        const low = s.mult < 1;
        const h = 34;
        const g = ctx.createLinearGradient(0, H - h, 0, H);
        if (jp) { g.addColorStop(0, 'rgba(255,207,94,.95)'); g.addColorStop(1, 'rgba(255,94,196,.85)'); }
        else if (hot) { g.addColorStop(0, 'rgba(255,94,196,.6)'); g.addColorStop(1, 'rgba(160,107,255,.45)'); }
        else if (low) { g.addColorStop(0, 'rgba(255,125,107,.35)'); g.addColorStop(1, 'rgba(120,40,60,.3)'); }
        else { g.addColorStop(0, 'rgba(160,107,255,.45)'); g.addColorStop(1, 'rgba(123,63,255,.35)'); }
        ctx.fillStyle = g;
        trapezoid(s.x, H - h / 2, s.w * 0.55, s.w * 0.94, h);
        ctx.fill();
        ctx.strokeStyle = jp ? 'rgba(255,255,255,.7)' : 'rgba(178,140,255,.35)';
        ctx.lineWidth = jp ? 2 : 1;
        ctx.stroke();
        // подпись множителя
        ctx.fillStyle = jp ? '#3a2300' : '#fff';
        ctx.font = 'bold ' + Math.max(9, Math.min(pegW * 0.3, 15)) + 'px Rubik, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.mult + '×', s.x, H - h / 2 + 1);
      });
      // шарик-трапеция
      if (ball) {
        const r = Math.max(9, pegW * 0.17);
        ctx.shadowColor = '#ffcf5e'; ctx.shadowBlur = 14;
        const g = ctx.createLinearGradient(0, ball.y - r, 0, ball.y + r);
        g.addColorStop(0, '#ffe9a8'); g.addColorStop(1, ball.hot ? '#ffcf5e' : '#ff9e3c');
        ctx.fillStyle = g;
        trapezoid(ball.x, ball.y, r * 1.1, r * 1.9, r * 1.7);
        ctx.fill();
        ctx.shadowBlur = 0;
        // блик
        ctx.beginPath();
        ctx.arc(ball.x - r * 0.35, ball.y - r * 0.35, r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fill();
      }
    }

    class Ball {
      constructor(x) {
        this.x = x; this.y = 20;
        this.vx = (Math.random() - 0.5) * 1.2;
        this.vy = 0;
        this.r = Math.max(9, pegW * 0.17);
        this.hot = true; this.settled = false;
      }
      step(dt) {
        this.vy += 520 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        for (const p of pegs) {
          const dx = this.x - p.x, dy = this.y - p.y;
          const d2 = dx * dx + dy * dy;
          const minD = this.r + p.r;
          if (d2 < minD * minD && d2 > 0) {
            const d = Math.sqrt(d2);
            const nx = dx / d, ny = dy / d;
            this.x = p.x + nx * minD;
            this.y = p.y + ny * minD;
            const vn = this.vx * nx + this.vy * ny;
            if (vn < 0) { this.vx -= 1.8 * vn * nx; this.vy -= 1.8 * vn * ny; }
            if (Math.random() < 0.05) this.vx += (Math.random() - 0.5) * 2;
            this.hot = false;
          }
        }
        if (this.x < this.r) { this.x = this.r; this.vx *= -0.5; }
        if (this.x > W - this.r) { this.x = W - this.r; this.vx *= -0.5; }
        if (this.y + this.r >= H - 2) { this.y = H - this.r - 2; this.settled = true; }
      }
    }

    function frame(t) {
      const dt = Math.min((t - lastTime) / 1000, 0.033);
      lastTime = t;
      if (ball && !ball.settled) {
        ball.step(dt);
        draw();
        if (ball.settled) settle();
        else raf = requestAnimationFrame(frame);
      }
    }

    function settle() {
      cancelAnimationFrame(raf);
      let best = slots[0], bd = 1e9;
      for (const s of slots) { const d = Math.abs(s.x - ball.x); if (d < bd) { bd = d; best = s; } }
      const mult = best.mult;
      const gross = Math.round(bet * mult); // полная выплата
      const net = gross - bet;              // чистыми (только для отображения)
      ball = null; busy = false;
      draw();
      if (mult >= 10) PC.confetti();
      // ставка уже списана при старте/переходе — начисляем ПОЛНЫЙ gross (не net)
      PC.balance(gross);
      if (net > 0) PC.win(); else PC.lose();
      PC.played();
      const placement = mult >= 50 ? '🔥 ДЖЕКПОТ!' : mult >= 5 ? '🎉 Большой куш!' : mult >= 1 ? '😄 Окупилось.' : '😅 Мелочь. Дом доволен.';
      const profitTxt = net >= 0 ? '+' + PC.fmt(net) : '-' + PC.fmt(-net);
      resultEl.textContent = `${placement} Множитель ${mult}× → ${profitTxt}`;
      resultEl.style.color = net > 0 ? 'var(--gold)' : (gross > 0 ? 'var(--green)' : 'var(--danger)');
      PC.toast(`🔻 Плонко ${mult}×: ${profitTxt}. ${net > 0 ? 'Пенка в восторге!' : PC.randJoke()}`, net > 0 ? 'gold' : (gross > 0 ? 'good' : 'bad'));
      showFinal();
    }

    let firstPaid = true; // первый шарик уже оплачен на экране ставки
    function drop(x) {
      if (busy) return;
      if (firstPaid) {
        firstPaid = false; // ставка уже списана в startGame — не списывать дважды
      } else {
        if (PC.state.balance < bet) { PC.toast('Не хватает рублей на шарик.', 'bad'); return; }
        PC.dec(bet);
      }
      PC.click();
      busy = true;
      resultEl.textContent = '';
      finalWrap.innerHTML = '';
      ball = new Ball(x);
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
      hint.textContent = `Шарик летит! Ставка ${PC.fmt(bet)}.`;
    }

    function showFinal() {
      finalWrap.innerHTML = '';
      const a = document.createElement('button');
      a.className = 'game-btn btn-primary';
      a.textContent = '🔻 Ещё шарик (' + PC.fmt(bet) + ')';
      a.onclick = () => { PC.click(); drop(W / 2 + (Math.random() - 0.5) * 30); };
      const b = document.createElement('button');
      b.className = 'game-btn btn-ghost';
      b.textContent = '⬅ К ставкам';
      b.onclick = () => back();
      finalWrap.appendChild(a); finalWrap.appendChild(b);
    }

    canvas.addEventListener('pointerdown', e => {
      const rect = canvas.getBoundingClientRect();
      drop(e.clientX - rect.left);
    });
    container.querySelectorAll('.pl-rows').forEach(b => {
      b.onclick = () => {
        PC.click();
        container.querySelectorAll('.pl-rows').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        rows = +b.dataset.v;
        layout();               // пересобрать слоты и РАЗБРОСАТЬ множители заново
      };
    });

    layout();
    window.addEventListener('resize', layout);
    const obs = new MutationObserver(() => {
      if (!document.getElementById('modalOverlay').classList.contains('open')) {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('resize', layout);
        obs.disconnect();
      }
    });
    obs.observe(document.getElementById('modalOverlay'), { attributes: true, attributeFilter: ['class'] });
  }
};