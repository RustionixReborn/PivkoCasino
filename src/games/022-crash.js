/* ============ ИГРА: ПЕННЫЙ КРАШ (раннер с коэффициентом) ============ */
/* Классический краш: коэффициент растёт от 1.00×, в случайный момент обвал.
   Успел нажать «Забрать» до краха — куш; не успел — ставка сгорела.
   Таверная-математика: момент краха выбирается так, что EV ≈ 0.93 (дом в плюсе ~7%).
   Формула: crash = max(1.00, 0.93 / (1 - U)), U ~ [0,1) — стандартное распределение краша. */
PC.games.crash = {
  id: 'crash', name: 'Пенный краш', emoji: '📈',
  cat: 'risk', free: false, minBet: 250, maxMult: '∞',
  bets: [250, 500, 1000, 2000, 5000],
  desc: 'Коэффициент растёт: 1.01×, 1.02×... Пока не лопнет пена. Успей забрать до обвала — или потеряешь всё.',
  tag: 'Раннер',
  start(el, bet, back) {
    const c = document.createElement('div');
    el.appendChild(c);
    c.innerHTML = `
      <div class="hint" id="crashHint">Ставка <b>${PC.fmt(bet)}</b>. Жми «Пуск» — и следи за пеной. Успей забрать до краха!</div>
      <div class="arena pos" id="crashArena" style="height:340px">
        <canvas id="crashCanvas" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
        <div id="crashMult" style="position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;z-index:2">
          <div style="text-align:center">
            <div class="big-num" id="crashBig" style="font-size:56px;transition:color .3s">1.00×</div>
            <div id="crashPot" style="color:var(--muted);font-weight:700;margin-top:4px">= 0 ₽</div>
          </div>
        </div>
        <div id="crashRunner" style="position:absolute;font-size:34px;z-index:3;pointer-events:none;transition:opacity .3s;left:8px;bottom:8px">🍺</div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:12px;flex-wrap:wrap">
        <button class="game-btn btn-primary" id="crashGo">🚀 Пуск!</button>
        <button class="game-btn btn-gold" id="crashCash" style="display:none">💰 Забрать</button>
      </div>
      <div class="hint" id="crashResult" style="font-weight:700;min-height:22px"></div>
      <div id="crashFinal" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"></div>
      <div class="hint" style="margin-top:8px" id="crashHistory"></div>
    `;
    const hintEl = c.querySelector('#crashHint');
    const canvas = c.querySelector('#crashCanvas');
    const ctx = canvas.getContext('2d');
    const big = c.querySelector('#crashBig');
    const pot = c.querySelector('#crashPot');
    const runner = c.querySelector('#crashRunner');
    const goBtn = c.querySelector('#crashGo');
    const cashBtn = c.querySelector('#crashCash');
    const resultEl = c.querySelector('#crashResult');
    const finalWrap = c.querySelector('#crashFinal');
    const historyEl = c.querySelector('#crashHistory');

    let running = false, crashed = false, mult = 1, crashAt = 0;
    let startT = 0, raf = null;
    const points = [];
    const history = [];

    function rollCrash() {
      // стандартное распределение краша с house edge: P(crash > x) = 0.93 / x
      const u = Math.random();
      const v = 0.93 / (1 - u);
      return Math.max(1.00, Math.min(1000, Math.floor(v * 100) / 100));
    }

    function resizeCanvas() {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width; canvas.height = r.height;
    }

    function drawGraph(t) {
      resizeCanvas();
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      if (points.length < 2) return;
      // масштаб: множитель вверх, время вправо (автоподгонка)
      const maxM = Math.max(mult, 1.5);
      const maxT = Math.max(t, 2);
      const sx = W / maxT, sy = (H - 40) / (maxM - 1);
      ctx.lineWidth = 3;
      const grad = ctx.createLinearGradient(0, H, W, 0);
      if (crashed) {
        grad.addColorStop(0, '#ff7d6b'); grad.addColorStop(1, '#ff2a4a');
      } else {
        grad.addColorStop(0, '#a06bff'); grad.addColorStop(1, '#5effb4');
      }
      ctx.strokeStyle = grad;
      ctx.shadowColor = crashed ? 'rgba(255,42,74,.8)' : 'rgba(94,255,180,.7)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = p.t * sx, y = H - 20 - (p.m - 1) * sy;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      // точка на конце
      const last = points[points.length - 1];
      const lx = last.t * sx, ly = H - 20 - (last.m - 1) * sy;
      ctx.beginPath();
      ctx.arc(lx, ly, 6, 0, Math.PI * 2);
      ctx.fillStyle = crashed ? '#ff2a4a' : '#5effb4';
      ctx.fill();
      // позиция бегунка (пивка) по графику
      const arenaH = 340;
      runner.style.left = (lx * (canvas.getBoundingClientRect().width / W)) + 'px';
      runner.style.bottom = (20 + (H - 20 - ly) * 0.35 + 10) + 'px';
      if (crashed) { runner.textContent = '💥'; } else { runner.textContent = '🍺'; }
    }

    function tick(now) {
      if (!running) return;
      const t = (now - startT) / 1000;
      // коэффициент растёт экспоненциально: чем дольше — тем быстрее
      mult = Math.pow(Math.E, 0.11 * t);
      mult = Math.floor(mult * 100) / 100;
      points.push({ t, m: mult });
      if (points.length > 600) points.shift();
      big.textContent = mult.toFixed(2) + '×';
      pot.textContent = '= ' + PC.fmt(Math.round(bet * mult));
      // цвет растёт: зелёный → золотой → красный по мере риска
      big.style.color = mult < 2 ? 'var(--green)' : mult < 5 ? 'var(--gold)' : 'var(--danger)';
      drawGraph(t);
      if (mult >= crashAt) {
        crash();
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    function go() {
      if (running) return;
      crashAt = rollCrash();
      mult = 1; crashed = false; running = true;
      points.length = 0;
      big.textContent = '1.00×';
      big.style.color = 'var(--text)';
      pot.textContent = '= ' + PC.fmt(bet);
      resultEl.textContent = '';
      runner.textContent = '🍺';
      goBtn.style.display = 'none';
      cashBtn.style.display = 'inline-block';
      hintEl.textContent = 'Пена растёт! Жми «Забрать», пока не лопнула!';
      startT = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function cashOut() {
      if (!running || crashed) return;
      running = false;
      cancelAnimationFrame(raf);
      const w = Math.round(bet * mult); // полная выплата
      const net = w - bet;              // чистыми (отображение)
      PC.balance(w); PC.win(); PC.played(); // ставка уже списана — начисляем gross
      if (mult >= 3) PC.confetti();
      resultEl.textContent = `💰 Забрал на ${mult.toFixed(2)}×! Чистыми +${PC.fmt(net)}. Бармен уважает.`;
      resultEl.style.color = 'var(--green)';
      PC.toast(`📈 Забрал на ${mult.toFixed(2)}×: +${PC.fmt(net)} ₽!`, mult >= 3 ? 'gold' : 'good');
      addHistory(mult, true);
      finish();
    }

    function crash() {
      running = false; crashed = true;
      cancelAnimationFrame(raf);
      big.textContent = crashAt.toFixed(2) + '×';
      big.style.color = 'var(--danger)';
      big.classList.add('shake');
      drawGraph(points.length ? points[points.length - 1].t : 0);
      PC.lose(); PC.played();
      resultEl.textContent = `💥 ОБВАЛ на ${crashAt.toFixed(2)}×! Пена лопнула, ставка сгорела. ${PC.randJoke()}`;
      resultEl.style.color = 'var(--danger)';
      PC.toast(`💥 Крах на ${crashAt.toFixed(2)}×. -${PC.fmt(bet)}.`, 'bad');
      addHistory(crashAt, false);
      finish();
    }

    function addHistory(m, win) {
      history.unshift({ m, win });
      if (history.length > 8) history.pop();
      historyEl.innerHTML = 'История: ' + history.map(h =>
        `<span style="color:${h.win ? 'var(--green)' : 'var(--danger)'};font-weight:700">${h.m.toFixed(2)}×</span>`
      ).join(' · ');
    }

    function finish() {
      cashBtn.style.display = 'none';
      goBtn.style.display = 'none';
      hintEl.textContent = '';
      finalWrap.innerHTML = '';
      const a = document.createElement('button');
      a.className = 'game-btn btn-primary';
      a.textContent = '🔁 Ещё раз (' + PC.fmt(bet) + ')';
      a.onclick = () => {
        if (PC.state.balance < bet) { PC.toast('Не хватает рублей.', 'bad'); return; }
        PC.dec(bet); PC.click(); go(); finalWrap.innerHTML = '';
      };
      const b = document.createElement('button');
      b.className = 'game-btn btn-ghost';
      b.textContent = '⬅ К ставкам';
      b.onclick = () => back();
      finalWrap.appendChild(a); finalWrap.appendChild(b);
    }

    goBtn.onclick = () => { PC.click(); go(); };
    cashBtn.onclick = () => { PC.click(); cashOut(); };
    // горячая клавиша: пробел — забрать во время полёта
    const keyHandler = e => {
      if (e.code === 'Space' && running && !crashed) { e.preventDefault(); cashOut(); }
    };
    window.addEventListener('keydown', keyHandler);
    const obs = new MutationObserver(() => {
      if (!document.getElementById('modalOverlay').classList.contains('open')) {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', keyHandler);
        obs.disconnect();
      }
    });
    obs.observe(document.getElementById('modalOverlay'), { attributes: true, attributeFilter: ['class'] });

    drawGraph(0);
  }
};