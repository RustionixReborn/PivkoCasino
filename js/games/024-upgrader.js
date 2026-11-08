/* ============ ИГРА: АПГРЕЙДЕР (одиночная, майнкрафт-стиль) ============ */
/* Кидаешь деньги (ставка) и выбираешь множитель: 2× 3× 5× 8× 10×.
   Чем выше множитель — тем ниже шанс успеха. Дом в плюсе: EV < 1 на каждом уровне.
   Визуал: псевдо-Minecraft — гексагональные рамки, центральное колесо шанса. */
(() => {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt = (n) => (typeof PC !== 'undefined' && PC.fmt) ? PC.fmt(n) : String(n);

  // уровни: множитель -> шанс успеха (%)
  const TIERS = [
    { mult: 2,  chance: 49 },
    { mult: 3,  chance: 32 },
    { mult: 5,  chance: 19 },
    { mult: 8,  chance: 12 },
    { mult: 10, chance: 9 },
  ];

  PC.games.upgrader = {
    id: 'upgrader', name: 'Апгрейдер', emoji: '⚡',
    cat: 'chance', free: false, minBet: 250, maxMult: 10,
    bets: [250, 500, 1000, 2000, 5000],
    desc: 'Поставь деньги и выбери множитель: 2×, 3×, 5×, 8× или 10×. Чем выше × — тем ниже шанс. Апгрейд всё решит за мгновение!',
    tag: 'Апгрейд',
    start(el, bet, back) {
      const c = document.createElement('div');
      el.appendChild(c);
      let active = true;
      let selected = TIERS[0]; // по умолчанию 2×
      let spinning = false;
      let wheelRot = 0; // накопленный угол вращения клина

      c.innerHTML = `
        <div style="text-align:center;padding:2px 0 10px">
          <div class="hint" style="margin:0 0 2px">Ставка: <b>${fmt(bet)} ₽</b>. Выбери множитель и жми «Играть»!</div>
        </div>
        <div class="ug-layout">
          <!-- панель ставки (влево) -->
          <div class="ug-panel">
            <div class="ug-panel-title">💰 СТАВКА</div>
            <div class="ug-item">
              <div class="ug-ico ug-ico-gold">💰</div>
              <div class="ug-val" id="ugBetVal">${fmt(bet)}</div>
            </div>
            <div class="ug-panel-sub">твои рубли в деле</div>
          </div>

          <!-- центральное колесо шанса -->
          <div class="ug-wheel-wrap">
            <svg class="ug-wheel" viewBox="0 0 200 200" id="ugWheel">
              <circle cx="100" cy="100" r="88" fill="#1a1408" stroke="#6b4a1b" stroke-width="6"/>
              <!-- клин шанса (вращается; ось вращения — центр) -->
              <g id="ugArcGroup" style="transform-origin:100px 100px">
                <path id="ugArc" fill="#ffd36a" opacity="0.95"/>
              </g>
              <!-- метки -->
              <g stroke="#e8d9a0" stroke-width="2" opacity="0.6">
                ${Array.from({length: 60}, (_, i) => {
                  const a = (i / 60) * Math.PI * 2;
                  const r1 = 74, r2 = i % 5 === 0 ? 60 : 70;
                  const x1 = 100 + r1 * Math.cos(a), y1 = 100 + r1 * Math.sin(a);
                  const x2 = 100 + r2 * Math.cos(a), y2 = 100 + r2 * Math.sin(a);
                  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
                }).join('')}
              </g>
              <circle cx="100" cy="100" r="46" fill="#241a0b" stroke="#6b4a1b" stroke-width="4"/>
              <!-- неподвижный указатель сверху -->
              <line x1="100" y1="100" x2="100" y2="22" stroke="#ff5b5b" stroke-width="5" stroke-linecap="round"/>
              <circle cx="100" cy="100" r="6" fill="#ff5b5b"/>
            </svg>
            <div class="ug-chance" id="ugChance">${selected.chance}%</div>
            <div class="ug-chance-label">шанс на <span id="ugChanceMult">×${selected.mult}</span></div>
          </div>

          <!-- панель выигрыша (вправо) -->
          <div class="ug-panel">
            <div class="ug-panel-title">💎 ВЫИГРЫШ</div>
            <div class="ug-item">
              <div class="ug-ico ug-ico-diamond">💎</div>
              <div class="ug-val ug-val-gold" id="ugWinVal">${fmt(bet * selected.mult)}</div>
            </div>
            <div class="ug-panel-sub">если повезёт</div>
          </div>
        </div>

        <!-- выбор множителя -->
        <div class="ug-tiers" id="ugTiers"></div>

        <!-- кнопка + результат -->
        <div style="text-align:center;margin-top:4px">
          <button class="btn btn-primary ug-forge" id="ugForge" style="width:100%">⚡ ИГРАТЬ!</button>
          <div class="hint ug-result" id="ugResult" style="font-weight:800;font-size:16px;min-height:22px;margin-top:10px"></div>
        </div>
        <div id="ugFinal" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:6px"></div>
      `;

      const result = c.querySelector('#ugResult');
      const finalWrap = c.querySelector('#ugFinal');
      const arc = c.querySelector('#ugArc');
      const arcGroup = c.querySelector('#ugArcGroup');
      const chanceEl = c.querySelector('#ugChance');
      const chanceMult = c.querySelector('#ugChanceMult');
      const winValEl = c.querySelector('#ugWinVal');
      const forgeBtn = c.querySelector('#ugForge');

      // клин рисуем от 0° (вверх, под неподвижную стрелку) против часовой — ширина frac*360°
      function drawArc() {
        const frac = selected.chance / 100;
        const a0 = -Math.PI / 2; // верх (12 часов) = позиция указателя
        const a1 = a0 + frac * Math.PI * 2;
        const x = 100, y = 100, r = 74;
        const p0 = [x + r * Math.cos(a0), y + r * Math.sin(a0)];
        const p1 = [x + r * Math.cos(a1), y + r * Math.sin(a1)];
        const large = a1 - a0 > Math.PI ? 1 : 0;
        arc.setAttribute('d', `M${x},${y} L${p0[0].toFixed(1)},${p0[1].toFixed(1)} A${r},${r} 0 ${large} 1 ${p1[0].toFixed(1)},${p1[1].toFixed(1)} Z`);
        arcGroup.style.transform = 'rotate(0deg)';
      }

      // построить кнопки множителей
      const tiersBox = c.querySelector('#ugTiers');
      TIERS.forEach(t => {
        const o = document.createElement('button');
        o.className = 'ug-tier' + (t.mult === selected.mult ? ' active' : '');
        o.innerHTML = `<span class="ug-tier-x">×${t.mult}</span><span class="ug-tier-ch">${t.chance}%</span>`;
        o.onclick = () => {
          if (spinning) return;
          PC.click();
          tiersBox.querySelectorAll('.ug-tier').forEach(x => x.classList.remove('active'));
          o.classList.add('active');
          selected = t;
          chanceEl.textContent = t.chance + '%';
          chanceMult.textContent = '×' + t.mult;
          winValEl.textContent = fmt(bet * t.mult);
          drawArc();
        };
        tiersBox.appendChild(o);
      });

      // блокировать/разблокировать кнопки множителей во время вращения
      function setTiersDisabled(disabled) {
        tiersBox.querySelectorAll('.ug-tier').forEach(x => x.disabled = disabled);
      }
      tiersBox.addEventListener('click', e => { if (spinning) e.preventDefault(); });

      function showFinal() {
        finalWrap.innerHTML = '';
        const b = document.createElement('button');
        b.className = 'game-btn btn-primary';
        b.textContent = '⬅ К ставкам';
        b.onclick = () => back();
        finalWrap.appendChild(b);
      }

      forgeBtn.onclick = () => {
        if (spinning || !active || !PC.loggedIn) return;
        PC.click();
        spinning = true;
        forgeBtn.disabled = true;
        setTiersDisabled(true); // блокируем множители, пока крутится
        result.textContent = '💫 Апгрейд решается…';

        // ширина зоны успеха в градусах
        const span = selected.chance * 3.6;
        const gap = 360 - span;
        const roll = Math.random() * 100;
        const success = roll < selected.chance;

        // целевой угол остановки клина под неподвижной стрелкой (0° = верх)
        let target;
        if (success) {
          // стрелка должна попасть ВНУТРЬ жёлтой зоны (с запасом от краёв)
          const m = Math.min(span * 0.2, 4);
          target = 360 - (m + Math.random() * Math.max(1, span - 2 * m));
        } else {
          // стрелка должна попасть ВНЕ зоны (в «пустой» сектор)
          const m = Math.min(gap * 0.2, 6);
          target = m + Math.random() * Math.max(1, gap - 2 * m);
        }
        target = ((target % 360) + 360) % 360;

        const spins = 5; // полных оборотов
        const cur = wheelRot % 360;
        const finalRot = wheelRot + spins * 360 + (((target - cur) % 360) + 360) % 360;
        wheelRot = finalRot;

        arcGroup.style.transition = 'transform 3.2s cubic-bezier(.12,.7,.15,1)';
        arcGroup.style.transform = 'rotate(' + finalRot.toFixed(2) + 'deg)';

        setTimeout(() => {
          const w = Math.round(bet * selected.mult);
          const net = w - bet;
          if (success) {
            PC.balance(w); // ставка уже списана — начисляем полную выплату
            PC.win(); PC.confetti();
            result.style.color = 'var(--green)';
            result.textContent = `🎉 Апгрейд! ×${selected.mult} → +${fmt(net)} ₽`;
            PC.toast(`⚡ Апгрейд ×${selected.mult}: +${fmt(net)} ₽! Отлично!`, 'gold');
          } else {
            PC.lose();
            result.style.color = 'var(--danger)';
            result.textContent = `💥 Слиток треснул. −${fmt(bet)} ₽. ${PC.randJoke()}`;
            PC.toast('💥 Не вышло. Ставка сгорела.', 'bad');
          }
          PC.played();
          active = false;
          spinning = false;
          forgeBtn.disabled = false;
          setTiersDisabled(false); // снова даём выбирать множитель
          forgeBtn.style.display = 'none';
          showFinal();
        }, 3300);
      };

      drawArc();
    },
  };
})();