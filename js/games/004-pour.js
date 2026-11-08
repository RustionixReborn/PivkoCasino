/* ============ ИГРА: НАЛЕЙ-КА (бесплатная) ============ */
/* Бесплатная игра: ставки нет. Отпусти кружку в золотой зоне — +250 ₽,
   рядом (широкая зона) — +125, мимо — 0. */
PC.games.pour = {
  id: 'pour', name: 'Налей-ка', emoji: '🍺',
  cat: 'skill', free: true, minBet: 0, maxMult: '—',
  desc: 'Зажми и удерживай — кружка наполняется. Отпусти в ЗОЛОТОЙ ЗОНЕ — 250 ₽! Рядом с зоной — 125 ₽. Мимо — ничего.',
  tag: 'Бесплатно',
  start(el, bet, back) {
    const c = document.createElement('div');
    el.appendChild(c);
    c.innerHTML = `
      <div class="hint" id="pourHint">Зажми кнопку — пойдёт пена. Отпусти в золотой зоне!</div>
      <div style="position:relative;height:210px;border-radius:14px;background:#1c0d38;border:1px solid var(--line);overflow:hidden">
        <!-- зона «почти» (широкая полоса) -->
        <div style="position:absolute;left:0;right:0;bottom:42%;height:16%;background:linear-gradient(180deg,rgba(255,207,94,.10),rgba(255,207,94,.20));border-top:1px dashed rgba(255,207,94,.55);border-bottom:1px dashed rgba(255,207,94,.55);z-index:2"></div>
        <!-- ИДЕАЛЬНАЯ линия ровно на высоте 50% наполнения -->
        <div id="pourZone" style="position:absolute;left:0;right:0;bottom:50%;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);box-shadow:0 0 12px rgba(255,207,94,.95);z-index:3"></div>
        <div id="pourFill" style="position:absolute;left:0;right:0;bottom:0;height:0%;background:linear-gradient(180deg,#ffd875,#e8a93c);transition:height .06s linear;z-index:1"></div>
        <div style="position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-size:13px;z-index:0">КРУЖКА 🍺 (бесплатно)</div>
        <div style="position:absolute;right:8px;bottom:50%;transform:translateY(-50%);font-size:10px;color:var(--gold);font-weight:700;z-index:4;opacity:.85">идеально</div>
      </div>
      <div style="text-align:center;margin-top:12px"><button class="game-btn btn-primary" id="pourBtn" style="touch-action:none;width:100%">🍺 Держи — лей!</button></div>
      <div class="hint" id="pourResult" style="font-weight:700;font-size:15px;min-height:22px"></div>
      <div id="pourFinal" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"></div>
    `;
    const hint = c.querySelector('#pourHint');
    const fill = c.querySelector('#pourFill');
    const btn = c.querySelector('#pourBtn');
    const result = c.querySelector('#pourResult');
    const finalWrap = c.querySelector('#pourFinal');

    let pouring = false, height = 0, raf = null, active = true;
    const PERFECT = 50; // высота (в %) идеального наполнения — совпадает с линией на экране

    function loop() {
      if (!pouring) return;
      height = Math.min(115, height + 0.8);
      fill.style.height = height + '%';
      raf = requestAnimationFrame(loop);
    }
    function release() {
      if (!pouring) return;
      pouring = false;
      if (raf) cancelAnimationFrame(raf);
      settle();
    }
    function settle() {
      active = false;
      const err = Math.abs(height - PERFECT);
      let delta, msg, tier;
      if (err <= 2) { delta = 250; msg = '🎯 ИДЕАЛЬНО! Ровно по линии. +250 ₽'; tier = 'gold'; PC.confetti(); PC.bubblePop(); }
      else if (err <= 8) { delta = 125; msg = '🙂 Почти! Рядом с золотой зоной. +125 ₽'; tier = 'good'; PC.bubblePop(); }
      else { delta = 0; msg = '💦 Мимо. На этот раз — 0 ₽. ' + PC.randJoke(); tier = 'bad'; }

      if (delta > 0) { PC.balance(delta); PC.win(); } else { PC.lose(); }
      PC.played();
      result.textContent = msg;
      result.style.color = delta > 0 ? 'var(--green)' : 'var(--danger)';
      PC.toast(msg, tier);
      hint.textContent = delta > 0 ? 'Отличная работа, цех доволен!' : 'Пена не прощает. Попробуй ещё!';
      setTimeout(() => showFinal(), 1100);
    }
    function showFinal() {
      finalWrap.innerHTML = '';
      const a = document.createElement('button');
      a.className = 'game-btn btn-primary';
      a.textContent = '🍺 Ещё кружку (бесплатно)';
      a.onclick = () => { PC.click(); reset(); };
      const b = document.createElement('button');
      b.className = 'game-btn btn-ghost';
      b.textContent = '⬅ К играм';
      b.onclick = () => back();
      finalWrap.appendChild(a); finalWrap.appendChild(b);
    }
    function reset() {
      active = true; height = 0; pouring = false;
      fill.style.height = '0%';
      result.textContent = '';
      finalWrap.innerHTML = '';
      btn.textContent = '🍺 Держи — лей!';
      hint.textContent = 'Зажми кнопку — пойдёт пена. Отпусти в золотой зоне!';
    }
    btn.addEventListener('pointerdown', e => { if (active) { e.preventDefault(); PC.click(); pouring = true; loop(); } });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
  }
};