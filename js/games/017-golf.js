/* ============ ИГРА: МИНИ-ГОЛЬФ (стилизованный, псевдо-3D) ============ */
/* Таверная-механика: ставка списана заранее. «Идеальная» сила удара случайна (40–80).
   Зажми — сила растёт, отпусти на нужной силе. Псевдо-3D: поле с перспективой,
   лунка «в глубине», мяч с тенью и уменьшением по мере приближения к лунке. */
PC.games.golf = {
  id: 'golf', name: 'Мини-гольф в кружку', emoji: '⛳',
  cat: 'skill', free: false, minBet: 250, maxMult: 8,
  bets: [250, 500, 1000, 2000],
  desc: 'Зажми и отпусти — мяч катится к кружке. Попадёшь ровно в силу — в лунку! Награда зависит от точности.',
  tag: 'Меткость',
  start(el, bet, back) {
    const c = document.createElement('div');
    el.appendChild(c);
    c.innerHTML = `
      <div class="hint" id="golfHint">Ставка <b>${PC.fmt(bet)}</b>. Зажми «ЗАМАХ» — сила растёт. Отпусти на идеальной силе!</div>
      <div style="position:relative;height:230px;border-radius:16px;overflow:hidden;border:1px solid var(--line);background:linear-gradient(180deg,#0d3b2a 0%,#14633f 55%,#1a7a4e 100%);box-shadow:inset 0 0 40px rgba(0,0,0,.45)" id="golfCourse">
        <!-- небо/дальний фон -->
        <div style="position:absolute;inset:0 0 65% 0;background:linear-gradient(180deg,#123a8f,#1e6fb0);opacity:.35"></div>
        <!-- трава: полосы для текстуры -->
        <div style="position:absolute;inset:0;opacity:.5">
          <div style="position:absolute;left:0;right:0;top:62%;height:4%;background:linear-gradient(180deg,rgba(255,255,255,.12),transparent)"></div>
        </div>
        <!-- дорожка к лунке (перспектива: широкая внизу, узкая у лунки) -->
        <div id="golfFairway" style="position:absolute;left:50%;top:18%;width:34%;height:74%;transform:translateX(-50%);background:linear-gradient(180deg,#3f9c6b,#2f8a5b);opacity:.55;clip-path:polygon(50% 0%, 58% 100%, 42% 100%)"></div>
        <!-- лунка (в глубине, маленькая с тенью-дыркой) -->
        <div id="golfHole" style="position:absolute;left:50%;top:26%;width:34px;height:34px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle at 50% 45%,#0a0a0a 0%,#000 60%,#2f8a5b 70%);box-shadow:0 2px 6px rgba(0,0,0,.5);z-index:3"></div>
        <!-- флажок -->
        <div style="position:absolute;left:50%;top:20%;transform:translateX(-50%) translateY(-100%);z-index:4;text-align:center">
          <div style="width:2px;height:22px;background:#fff;margin:0 auto"></div>
          <div style="width:16px;height:10px;background:var(--gold);border-radius:2px;margin:-1px auto 0"></div>
        </div>
        <!-- мяч (обёртка двигается к лунке, сам мяч с тенью) -->
        <div id="golfBallWrap" style="position:absolute;left:50%;bottom:30px;transform:translateX(-50%);z-index:5">
          <div id="golfBallShadow" style="width:26px;height:8px;border-radius:50%;background:rgba(0,0,0,.4);filter:blur(3px);margin-top:18px"></div>
          <div id="golfBall" style="position:absolute;left:1px;top:0;width:24px;height:24px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffffff,#d0d0d0 60%,#a0a0a0);box-shadow:inset -3px -4px 6px rgba(0,0,0,.3)"></div>
        </div>
        <!-- индикатор силы -->
        <div id="golfBar" style="position:absolute;bottom:8px;left:12px;right:12px;height:14px;border-radius:99px;background:rgba(0,0,0,.35);overflow:hidden;z-index:7">
          <div id="golfFill" style="height:100%;width:0%;background:linear-gradient(90deg,#5effb4,#ffd36a 55%,#ff5b5b)"></div>
        </div>
        <div style="position:absolute;top:8px;left:10px;color:#d5f7e0;font-size:11px;font-weight:700;z-index:8;text-shadow:0 1px 2px rgba(0,0,0,.6)">⛳ ЛУНКА</div>
      </div>
      <div style="text-align:center;margin-top:12px"><button class="game-btn btn-primary" id="golfBtn" style="touch-action:none;width:100%">⛳ ЗАМАХ!</button></div>
      <div class="hint" id="golfResult" style="font-weight:700;min-height:20px"></div>
      <div id="golfFinal" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"></div>
    `;
    const hint = c.querySelector('#golfHint');
    const fill = c.querySelector('#golfFill');
    const btn = c.querySelector('#golfBtn');
    const ballWrap = c.querySelector('#golfBallWrap');
    const ball = c.querySelector('#golfBall');
    const ballShadow = c.querySelector('#golfBallShadow');
    const result = c.querySelector('#golfResult');
    const finalWrap = c.querySelector('#golfFinal');

    let power = 0, raf = null, ideal = 40 + Math.random() * 40, active = true;

    function loop() {
      if (power >= 100) { release(); return; }
      power = Math.min(100, power + 1.8);
      fill.style.width = power + '%';
      raf = requestAnimationFrame(loop);
    }
    function release() {
      if (!active) return;
      active = false;
      if (raf) cancelAnimationFrame(raf);
      const err = Math.abs(power - ideal);
      const p = power;
      power = 0;
      let w = 0, msg = '';
      // мяч КАТИТСЯ к лунке: обёртка поднимается (bottom растёт), мяч и тень
      // уменьшаются от перспективы — так выглядит "улетел в глубину к лунке"
      // лунка на ~26% сверху → bottom ≈ 74% от высоты поля (230px)
      ballWrap.style.transition = 'bottom 1s cubic-bezier(.15,.6,.25,1)';
      ballWrap.style.bottom = Math.round(230 * 0.74) + 'px';
      ball.style.transition = 'transform .9s ease, opacity .9s ease';
      ballShadow.style.transition = 'transform .9s ease, opacity .9s ease';
      // по пути мяч уменьшается (перспектива) и к лунке гаснет
      ball.style.transform = 'scale(.35)';
      ballShadow.style.transform = 'scale(.35)';
      ball.style.opacity = '0.25';
      ballShadow.style.opacity = '0.2';
      let tier;
      if (err < 3) { w = bet * 8; tier = 'gold'; setTimeout(() => { ball.style.opacity = '0'; }, 620); PC.confetti(); msg = '⛳ В ЛУНКУ! Идеально!'; }
      else if (err < 8) { w = bet * 2; tier = 'good'; msg = '🏌 Около лунки.'; }
      else if (err < 14) { w = bet * 1.1; tier = 'good'; msg = '🙂 Почти-почти.'; }
      else if (err < 22) { w = bet * 0.5; tier = 'good'; msg = '😐 Удар не в ту силу.'; }
      else { w = 0; tier = 'bad'; msg = '💨 Мимо лунки. ' + PC.randJoke(); }

      const net = Math.round(w - bet);
      PC.balance(w);
      if (net > 0) { PC.win(); } else if (w > 0) { PC.win(); } else PC.lose();
      PC.played();
      result.textContent = msg + (w > 0 ? ' Итог: ' + (net >= 0 ? '+' : '') + PC.fmt(net) + '.' : ' Итог: -' + PC.fmt(bet) + '.');
      PC.toast(msg + (w > 0 ? ' +' + PC.fmt(w) + ' ₽ выигрыша (из них чистыми ' + (net >= 0 ? '+' : '') + PC.fmt(net) + ')' : ' Ставка сгорела.'), tier);

      btn.style.display = 'none';
      setTimeout(() => showFinal(net >= 0), 1000);
    }
    function showFinal(profit) {
      finalWrap.innerHTML = '';
      const a = document.createElement('button');
      a.className = 'game-btn btn-primary';
      a.textContent = '🔁 Ещё удар (' + PC.fmt(bet) + ')';
      a.onclick = () => { PC.click(); if (PC.state.balance < bet) { PC.toast('Не хватает рублей.', 'bad'); return; } PC.dec(bet); resetShot(); };
      const b = document.createElement('button');
      b.className = 'game-btn btn-ghost';
      b.textContent = '⬅ К ставкам';
      b.onclick = () => back();
      finalWrap.appendChild(a); finalWrap.appendChild(b);
    }
    function resetShot() {
      active = true;
      result.textContent = '';
      finalWrap.innerHTML = '';
      ballWrap.style.transition = 'none';
      ballWrap.style.bottom = '30px'; // вернуть мяч на старт
      ball.style.transition = 'none';
      ball.style.transform = 'scale(1)';
      ball.style.opacity = '1';
      ballShadow.style.transition = 'none';
      ballShadow.style.transform = 'scale(1)';
      ballShadow.style.opacity = '1';
      void ballWrap.offsetHeight; // сбросить transition перед новым ударом
      fill.style.width = '0%';
      ideal = 40 + Math.random() * 40;
      btn.style.display = 'inline-block';
      btn.textContent = '⛳ ЗАМАХ!';
      hint.textContent = 'Ставка ' + PC.fmt(bet) + '. Зажми и отпусти на идеальной силе!';
    }
    btn.addEventListener('pointerdown', e => { if (active) { e.preventDefault(); PC.click(); power = 0; loop(); } });
    btn.addEventListener('pointerup', () => active && release());
    btn.addEventListener('pointerleave', () => active && release());

    resetShot();
  }
};