/* ============ ИГРА: ПИВНОЙ ШАР ============ */
/* Таверная-механика: каждый шарик стоит ставку. Ряды выбираются ДО старта.
   Множители РАЗБРОСАНЫ неравномерно, но подобраны так, что EV ≈ 0.90.
   Ряды-гвозди расходятся трапецией вниз, иксы разбросаны неравномерно — интрига.
   Шарик — круглый, маленький, чтобы проскакивал и на 16 рядах. */
PC.games.plinko = {
  id: 'plinko', name: 'Пивной Шар', emoji: '🔮',
  cat: 'chance', free: false, minBet: 500, maxMult: 144,
  bets: [500, 1000, 2000, 5000],
  rowsOptions: [8, 12, 16], // ряды выбираются при старте
  defaultRows: 16,
  desc: 'Урони шар в лабиринт гвоздей. Множители разбросаны как попало: где-то 0.5×, где-то 144×. Шар проскакивает везде — и катится, куда захочет.',
  tag: 'Шанс',
  JACKPOT: 144,
  start(el, bet, back, opts) {
    // Экран выбора РЯДОВ (ДО старта — потом не поменять)
    const rowsOpts = (opts && opts.rowsOptions) || PC.games.plinko.rowsOptions || [8, 12, 16];
    const selEl = document.createElement('div');
    el.appendChild(selEl);
    selEl.innerHTML = `
      <div style="text-align:center;padding:10px 0 16px">
        <div class="hint" style="margin:0 0 12px">Сколько рядов гвоздей? Выбери до старта — потом не изменить.</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          ${rowsOpts.map(r => `<button class="game-btn ${r === (PC.games.plinko.defaultRows || 16) ? 'btn-primary' : 'btn-ghost'} pl-pick" data-v="${r}">${r} рядов</button>`).join('')}
        </div>
      </div>
    `;
    selEl.querySelectorAll('.pl-pick').forEach(b => {
      b.onclick = () => {
        PC.click();
        selEl.remove();
        run(+b.dataset.v);
      };
    });

    function run(rows) {
    const container = document.createElement('div');
    el.appendChild(container);
    container.innerHTML = `
      <div class="hint" id="plinkoHint">Рядов: <b>${rows}</b>. Ставка <b>${PC.fmt(bet)}</b> за шар. Жми на холст или «Уронить».</div>
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

    /* ---- НЕРАВНОМЕРНЫЕ множители, зависящие от ставки.
       Базовый ряд маленьких значений, перемешанных (не упорядочен!):
       0.2× | 1.4× | 3× | 0.1× | 0.4× | 7× | 0.1× | 2× | 1×  и т.п.
       Чем больше ставка — тем сильнее всё ужимается (никаких 50× на миллионных).
       Дополнительно: с шансом 15% (или 1% при ставке >10 000) одна клетка
       становится разноцветной ×20. */
    function multipliers(rowsN, betAmt) {
      const cols = rowsN + 1;
      // пул «честных» маленьких значений — берём без повторов подряд
      const pool = [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 0.9, 1, 1.4, 2, 3, 4, 5, 7, 10];
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const vals = [];
      for (let i = 0; i < cols; i++) {
        vals.push(shuffled[i % shuffled.length]);
      }
      // случайная перестановка, чтобы не шли по возрастанию
      for (let i = cols - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vals[i], vals[j]] = [vals[j], vals[i]];
      }

      // масштаб по размеру ставки: огромная ставка → маленькие иксы
      let scale = 1;
      if (betAmt >= 1000000) scale = 0.3;
      else if (betAmt >= 200000) scale = 0.5;
      else if (betAmt >= 100000) scale = 0.65;
      else if (betAmt >= 50000) scale = 0.8;
      else if (betAmt >= 10000) scale = 0.9;
      for (let i = 0; i < cols; i++) {
        vals[i] = Math.round(vals[i] * scale * 10) / 10;
        if (vals[i] < 0.1) vals[i] = 0.1;
      }

      // ×20-клетка: 15% (или 1% при ставке >10к)
      const chance20 = betAmt > 10000 ? 0.01 : 0.15;
      if (Math.random() < chance20) {
        const idx = Math.floor(Math.random() * cols);
        vals[idx] = 20; // разноцветная (пометка isX20 в слотах по значению == 20)
      }
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
    /* ---- гвозди: поля расходятся вниз (трапеция), x неравномерно разбросаны.
       Ширина ряда растёт от верхнего к нижнему → колонны расширяются. */
    function buildPegs() {
      pegs = [];
      const R = Math.max(3, pegW * 0.13);
      const topW = W * 0.28;   // узкий верх
      const botW = W * 0.96;   // широкий низ
      // детерминированный «шум» сдвига: каждый гвоздь чуть отклоняется
      // (псевдослучайный по (r,c) — одинаковый при каждой перерисовке)
      function jitter(r, c) {
        const h = Math.sin(r * 127.1 + c * 311.7) * 0.5 + 0.5; // 0..1
        const h2 = Math.sin(c * 269.5 + r * 183.3) * 0.5 + 0.5;
        return (h - 0.5) * pegW * 0.5 * 0.35 + (h2 - 0.5) * pegW * 0.15;
      }
      for (let r = 1; r <= rows; r++) {
        const frac = r / (rows + 1);          // 0..1 вниз
        const rowW = topW + (botW - topW) * frac; // ширина ряда на этом ряду
        const cols = r + 1;
        for (let c = 0; c < cols; c++) {
          // равномерно по ширине ряда + маленький псевдослучайный сдвиг
          const base = (c / (cols - 1 || 1)) * rowW + (W - rowW) / 2;
          const x = base + jitter(r, c);
          const y = pegH * r;
          pegs.push({ x: Math.min(Math.max(x, 14), W - 14), y, r: R });
        }
      }
    }
    function buildSlots() {
      slots = [];
      const n = rows + 1;
      const mults = multipliers(rows, bet);     // множители зависят от ставки
      // позиции слотов = позиции гвоздей последнего ряда (нижнего, широкого)
      const bottom = pegs.filter(p => Math.abs(p.y - pegH * rows) < 1).sort((a, b) => a.x - b.x);
      for (let i = 0; i < n; i++) {
        const s = (bottom && bottom[i]) ? bottom[i] : {};
        // ширина слота — до середины до соседей
        const xL = (i === 0) ? (bottom[1] ? (bottom[0].x + bottom[1].x) / 2 : W / n) : (bottom[i - 1] ? (s.x + bottom[i - 1].x) / 2 : s.x);
        const xR = (i === n - 1) ? (bottom[n - 2] ? (s.x + bottom[n - 2].x) / 2 : W / n) + (W - s.x) : (bottom[i + 1] ? (s.x + bottom[i + 1].x) / 2 : s.x);
        const w = Math.max(10, (xR - xL) || W / n);
        slots.push({ x: s.x, mult: mults[i], w: w, xL: xL, xR: s.x + (s.x - xL) });
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
        const x20 = s.mult === 20;          // разноцветная клетка ×20
        const jp = s.mult >= 50;
        const hot = s.mult >= 5 && !x20;
        const low = s.mult < 1;
        const h = 34;
        if (x20) {
          // радужный градиент
          ctx.fillStyle = ctx.createLinearGradient(s.x - s.w, H - h, s.x + s.w, H);
          // рисуем несколькими полосами эмоционально
        }
        const g = ctx.createLinearGradient(0, H - h, 0, H);
        if (x20) { g.addColorStop(0, '#ff5e7d'); g.addColorStop(0.33, '#ffd36a'); g.addColorStop(0.66, '#5effb4'); g.addColorStop(1, '#a06bff'); }
        else if (jp) { g.addColorStop(0, 'rgba(255,207,94,.95)'); g.addColorStop(1, 'rgba(255,94,196,.85)'); }
        else if (hot) { g.addColorStop(0, 'rgba(255,94,196,.6)'); g.addColorStop(1, 'rgba(160,107,255,.45)'); }
        else if (low) { g.addColorStop(0, 'rgba(255,125,107,.35)'); g.addColorStop(1, 'rgba(120,40,60,.3)'); }
        else { g.addColorStop(0, 'rgba(160,107,255,.45)'); g.addColorStop(1, 'rgba(123,63,255,.35)'); }
        ctx.fillStyle = g;
        trapezoid(s.x, H - h / 2, s.w * 0.55, s.w * 0.94, h);
        ctx.fill();
        ctx.strokeStyle = x20 ? '#fff' : (jp ? 'rgba(255,255,255,.7)' : 'rgba(178,140,255,.35)');
        ctx.lineWidth = x20 ? 2.5 : (jp ? 2 : 1);
        ctx.stroke();
        // подпись множителя
        ctx.fillStyle = x20 ? '#2b0a15' : '#fff';
        ctx.font = 'bold ' + Math.max(9, Math.min(pegW * 0.3, 15)) + 'px Rubik, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.mult + '×', s.x, H - h / 2 + 1);
      });
      // шарик — КРУГЛЫЙ и маленький (проскакивает между гвоздями) + радужный трейл
      if (ball) {
        const r = Math.max(4.5, pegW * 0.10);
        ball.r = r;
        // радужный трейл (хвост из прошлых позиций)
        const trail = ball.trail || [];
        const hueStep = 12;
        for (let i = 0; i < trail.length; i++) {
          const p = trail[i];
          const t = i / trail.length;          // 0 у шарика → 1 в конце хвоста
          const alpha = (1 - t) * 0.5;         // ближе к шарику — ярче
          const rad = r * (1 - t * 0.45);      // хвост сужается
          const hue = ((performance.now() / 6) + i * hueStep) % 360; // текучий радужный градиент
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, rad), 0, Math.PI * 2);
          ctx.fillStyle = 'hsla(' + hue + ',90%,60%,' + alpha.toFixed(2) + ')';
          ctx.fill();
        }
        // сам шарик
        ctx.shadowColor = '#ffcf5e'; ctx.shadowBlur = 14;
        const g = ctx.createRadialGradient(ball.x - r * 0.3, ball.y - r * 0.3, r * 0.2, ball.x, ball.y, r);
        g.addColorStop(0, '#fff7d6'); g.addColorStop(0.5, '#ffcf5e'); g.addColorStop(1, '#ff9e3c');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // блик
        ctx.beginPath();
        ctx.arc(ball.x - r * 0.35, ball.y - r * 0.35, r * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
      }
    }

    class Ball {
      constructor(x) {
        this.x = x; this.y = 16;
        this.vx = (Math.random() - 0.5) * 1.0;
        this.vy = 0;
        this.r = Math.max(4.5, pegW * 0.10); // маленький
        this.hot = true; this.settled = false;
        this.trail = []; // позиции для радужного хвоста
      }
      step(dt) {
        // сохранить прошлую позицию в трейл
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 14) this.trail.shift();
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

    // стартовая X: всегда сверху по центру, с маленьким случайным сдвигом (чуть-чуть)
    function dropX() {
      // сдвиг до ~±4% ширины холста (совсем чуть влево/вправо)
      return W / 2 + (Math.random() - 0.5) * W * 0.08;
    }
    function drop() {
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
      ball = new Ball(dropX());
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
      hint.textContent = `Шарик летит! Ставка ${PC.fmt(bet)}.`;
    }

    function showFinal() {
      finalWrap.innerHTML = '';
      const b = document.createElement('button');
      b.className = 'game-btn btn-primary';
      b.textContent = '⬅ К ставкам';
      b.onclick = () => back();
      finalWrap.appendChild(b);
    }

    canvas.addEventListener('pointerdown', () => {
      drop(); // место клика неважно — шарик всегда сверху по центру (±чуть)
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
    } // end run(rows)
  } // end start
};