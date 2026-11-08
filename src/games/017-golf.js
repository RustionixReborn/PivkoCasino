/* ============ ИГРА: МИНИ-ГОЛЬФ В КРУЖКУ ============ */
/* Таверная-механика: ставка списана заранее. «Идеальная» сила удара случайна (40–80).
   Только попадание в узкое окно даёт чистый выигрыш; рядом — возврат меньше ставки. */
PC.games.golf = {
  id: 'golf', name: 'Мини-гольф в кружку', emoji: '⛳',
  cat: 'skill', free: false, minBet: 250, maxMult: 8,
  bets: [250, 500, 1000, 2000],
  desc: 'Зажми и отпусти — мяч летит к кружке. Но «идеальная» сила у каждого удара своя: таверна не любит, когда метко.',
  tag: 'Меткость',
  start(el, bet, back) {
    const c = document.createElement('div');
    el.appendChild(c);
    c.innerHTML = `
      <div class="hint" id="golfHint">Ставка <b>${PC.fmt(bet)}</b>. Зажми — сила растёт. Отпусти в золотой зоне!</div>
      <div style="position:relative;height:200px;border-radius:14px;background:linear-gradient(180deg,#1f1f8f,#1c5a2c);border:1px solid var(--line);overflow:hidden" id="golfCourse">
        <div id="golfZone" style="position:absolute;left:0;right:0;top:22%;height:5px;background:linear-gradient(90deg,transparent,var(--gold),transparent);box-shadow:0 0 12px rgba(255,207,94,.8);z-index:2"></div>
        <div id="golfBall" style="position:absolute;bottom:18px;left:6%;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 0 12px rgba(255,255,255,.6);z-index:4"></div>
        <div id="golfBar" style="position:absolute;bottom:6px;right:10px;left:10px;height:12px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden"><div id="golfFill" style="height:100%;width:0%;background:linear-gradient(90deg,var(--green),var(--gold),var(--danger))"></div></div>
      </div>
      <div style="text-align:center;margin-top:10px"><button class="game-btn btn-primary" id="golfBtn" style="touch-action:none;width:100%">⛳ ЗАМАХ!</button></div>
      <div class="hint" id="golfResult" style="font-weight:700;min-height:20px"></div>
      <div id="golfFinal" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"></div>
    `;
    const hint = c.querySelector('#golfHint');
    const fill = c.querySelector('#golfFill');
    const btn = c.querySelector('#golfBtn');
    const ball = c.querySelector('#golfBall');
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
      power = 0;
      let w = 0, msg = '';
      ball.style.transition = 'all .7s cubic-bezier(.3,.7,.3,1)';
      ball.style.left = '70%';
      let tier;
      if (err < 4) { w = bet * 8; tier = 'gold'; ball.style.opacity = '.2'; ball.style.transform = 'scale(.3)'; PC.confetti(); msg = '⛳ В ЛУНКУ!'; }
      else if (err < 10) { w = bet * 1.6; tier = 'good'; msg = '🏌 Около лунки.'; }
      else if (err < 18) { w = bet * 0.5; tier = 'good'; msg = '🙂 Почти-почти.'; }
      else { w = 0; tier = 'bad'; msg = '💨 Мимо. ' + PC.randJoke(); }

      const net = Math.round(w - bet); // чистыми (для отображения), ставка уже списана
      // начисляем ПОЛНУЮ выплату; если меньше ставки — баланс всё равно вырастет меньше,
      // чем списали входа, т.е. игрок в минусе
      PC.balance(w);
      if (net > 0) { PC.win(); } else if (w > 0) { PC.win(); } else PC.lose();
      PC.played();
      result.textContent = msg + (w > 0 ? ' Итог: ' + (net >= 0 ? '+' : '') + PC.fmt(net) + '.' : ' Итог: -' + PC.fmt(bet) + '.');
      PC.toast(msg + (w > 0 ? ' +' + PC.fmt(w) + ' ₽ выигрыша (из них чистыми ' + (net >= 0 ? '+' : '') + PC.fmt(net) + ')' : ' Ставка сгорела.'), tier);

      btn.style.display = 'none';
      showFinal(net >= 0);
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
      ball.style.transition = 'none';
      ball.style.left = '6%'; ball.style.bottom = '18px'; ball.style.opacity = '1'; ball.style.transform = '';
      fill.style.width = '0%';
      ideal = 40 + Math.random() * 40;
      result.textContent = '';
      btn.style.display = 'inline-block';
      btn.textContent = '⛳ ЗАМАХ!';
      hint.textContent = 'Ставка ' + PC.fmt(bet) + '. Зажми и отпусти в золотой зоне!';
    }
    btn.addEventListener('pointerdown', e => { if (active) { e.preventDefault(); PC.click(); power = 0; loop(); } });
    btn.addEventListener('pointerup', () => active && release());
    btn.addEventListener('pointerleave', () => active && release());

    resetShot();
  }
};