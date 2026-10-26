'use strict';

/* ================= Сцена: бутылки на конвейере ================= */
const CW = 960, CH = 540, C_DUR = 14, BELT_V = 250, LINE_X = 600;
const C_TOP = 110, C_BOTTOM = 430, R = 19;
const BTYPES = {
  blue: { fill: '#2d6cdf', cap: '#1b4aa8', label: 'Синие', ai: '#6e9bff' },
  teal: { fill: '#1fb3a6', cap: '#147d74', label: 'Бирюзовые' },
  green: { fill: '#3aa655', cap: '#256e37', label: 'Зелёные' },
  clear: { fill: 'rgba(215,232,240,.32)', cap: '#e6eef2', label: 'Прозрачные', stroke: 'rgba(255,255,255,.6)' },
  brown: { fill: '#8a5a2b', cap: '#5e3b1a', label: 'Коричневые' },
};
const OTHER = ['teal', 'green', 'clear', 'brown'];

// Полоса объектов: u — расстояние от «головы» потока, y — поперёк ленты
function makeFlow(len, total, blue) {
  const items = [];
  const free = (u, y) => items.every((o) => (o.u - u) ** 2 + (o.y - y) ** 2 >= 41 * 41);
  let guard = 0;
  while (items.length < total && guard++ < 20000) {
    let u, y;
    if (items.length && Math.random() < 0.45) {
      // Скопления: новая бутылка вплотную к уже стоящей
      const o = pick(items), a = rand(0, Math.PI * 2);
      u = o.u + Math.cos(a) * 42; y = o.y + Math.sin(a) * 42;
    } else {
      u = rand(0, len); y = rand(C_TOP + 30, C_BOTTOM - 30);
    }
    if (u < 0 || u > len || y < C_TOP + 28 || y > C_BOTTOM - 28 || !free(u, y)) continue;
    items.push({ u, y });
  }
  const types = shuffle(items.map((_, i) => (i < blue ? 'blue' : pick(OTHER))));
  items.forEach((o, i) => { o.type = types[i]; });
  // Порядковый номер синей бутылки при пересечении линии
  items.filter((o) => o.type === 'blue').sort((a, b) => a.u - b.u).forEach((o, k) => { o.n = k + 1; });
  return items;
}

const xAt = (o, t) => -30 + BELT_V * t - o.u;

function drawConveyor(ctx, t) {
  ctx.fillStyle = '#10151b'; ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = '#232a33'; ctx.fillRect(0, C_TOP, CW, C_BOTTOM - C_TOP);
  const step = 44, off = (BELT_V * t) % step;
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = off - step; x < CW; x += step) { ctx.moveTo(x, C_TOP); ctx.lineTo(x, C_BOTTOM); }
  ctx.stroke();
  ctx.fillStyle = '#3a4452';
  ctx.fillRect(0, C_TOP - 12, CW, 12); ctx.fillRect(0, C_BOTTOM, CW, 12);
}

function drawBottle(ctx, x, y, type) {
  const T = BTYPES[type];
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.arc(x + 3, y + 4, R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = T.fill;
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  if (T.stroke) { ctx.strokeStyle = T.stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.fillStyle = T.cap;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.beginPath(); ctx.arc(x - 7, y - 7, 4.5, 0, Math.PI * 2); ctx.fill();
}

// Отрисовка кадра; base — счётчики предыдущих циклов (для бесконечного hero)
function drawFlow(ctx, items, t, ai, base = null) {
  drawConveyor(ctx, t);
  const counts = { blue: 0, teal: 0, green: 0, clear: 0, brown: 0 };
  items.forEach((o) => {
    const x = xAt(o, t);
    if (x >= LINE_X) counts[o.type]++;
    if (x < -40 || x > CW + 40) return;
    drawBottle(ctx, x, o.y, o.type);
    if (!ai) return;
    const s = R * 2 + 6;
    if (o.type === 'blue') {
      const fresh = x >= LINE_X && x - LINE_X < BELT_V * 0.3;
      if (fresh) { ctx.fillStyle = 'rgba(46,230,168,.3)'; ctx.fillRect(x - s / 2, o.y - s / 2, s, s); }
      ctx.strokeStyle = BTYPES.blue.ai; ctx.lineWidth = 2;
      ctx.strokeRect(x - s / 2, o.y - s / 2, s, s);
      tag(ctx, x - s / 2, o.y - s / 2, `#${(base ? base.blue : 0) + o.n}`, BTYPES.blue.ai, '#06122b', 10);
    } else {
      ctx.strokeStyle = 'rgba(200,210,220,.3)'; ctx.lineWidth = 1;
      ctx.strokeRect(x - s / 2, o.y - s / 2, s, s);
    }
  });
  if (!ai) return counts;

  ctx.setLineDash([8, 6]); ctx.strokeStyle = '#2ee6a8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(LINE_X, C_TOP - 24); ctx.lineTo(LINE_X, C_BOTTOM + 24); ctx.stroke();
  ctx.setLineDash([]);
  tag(ctx, LINE_X - 50, C_BOTTOM + 48, 'ЛИНИЯ СЧЁТА', '#2ee6a8', '#06281d', 11);

  const total = (k) => counts[k] + (base ? base[k] : 0);
  const w = tag(ctx, 16, 46, `СИНИЕ: ${total('blue')}`, BTYPES.blue.ai, '#06122b', 18);
  let x = 16 + w + 10;
  OTHER.forEach((k) => { x += tag(ctx, x, 44, `${BTYPES[k].label.toUpperCase()}: ${total(k)}`, 'rgba(30,38,48,.95)', '#c9d3dd', 12) + 6; });
  const all = Object.keys(counts).reduce((a, k) => a + total(k), 0);
  tag(ctx, 16, 78, `ИИ · ВСЕГО: ${all}`, '#2ee6a8', '#06281d', 12);
  return counts;
}

/* ================= Игра: сосчитайте синие ================= */
function initCountingGame() {
  const canvas = $('#g-canvas');
  const ctx = setupCanvas(canvas, CW, CH);
  const status = $('#g-status');
  const result = $('#g-result');
  const tapBtn = $('#g-tap'), undoBtn = $('#g-undo');
  const timerEl = $('#g-timer'), countEl = $('#g-count'), progress = $('#g-progress');
  const LEN = BELT_V * (C_DUR - (CW + 70) / BELT_V);

  let state = 'idle', items = makeFlow(LEN, 44, 15), t0 = 0, count = 0, replayT = 0, last = 0;

  const setStatus = (html, kind = '') => { status.innerHTML = html; status.className = 'status' + (kind ? ' status--' + kind : ''); };

  function frame(now) {
    if (state === 'run') {
      const t = (now - t0) / 1000;
      const left = Math.max(0, C_DUR - t);
      timerEl.textContent = left.toFixed(1).replace('.', ',') + ' с';
      progress.style.transform = `scaleX(${left / C_DUR})`;
      drawFlow(ctx, items, Math.min(t, C_DUR), false);
      if (left <= 0) return finish();
    } else if (state === 'replay') {
      replayT = (replayT + Math.min((now - last) / 1000, 0.05) * 1.5) % C_DUR;
      last = now;
      drawFlow(ctx, items, replayT, true);
    } else return;
    requestAnimationFrame(frame);
  }

  function add(d) {
    if (state !== 'run') return;
    count = Math.max(0, count + d);
    countEl.textContent = count;
    undoBtn.disabled = count === 0;
  }

  function start() {
    $('#g-start').hidden = true;
    items = makeFlow(LEN, 44, 13 + Math.floor(rand(0, 5)));
    count = 0;
    countEl.textContent = '0';
    result.hidden = true;
    tapBtn.disabled = false;
    undoBtn.disabled = true;
    state = 'run';
    setStatus('Жмите «+1» на каждую синюю бутылку');
    t0 = performance.now();
    requestAnimationFrame(frame);
  }

  function finish() {
    state = 'replay';
    tapBtn.disabled = true;
    undoBtn.disabled = true;
    timerEl.textContent = '0,0 с';
    const truth = items.filter((o) => o.type === 'blue').length;
    const err = Math.abs(count - truth);
    const pct = Math.round((err / truth) * 100);
    $('#r-human').textContent = count;
    $('#r-ai').textContent = truth;
    $('#r-copy').innerHTML = err === 0
      ? `Точно в цель — ${truth} из ${truth}! Вы справились так же, как ИИ.`
      : `Вы насчитали ${count}, а синих было ${truth}. Ошибка — <b>${err} ${plural(err, ['бутылка', 'бутылки', 'бутылок'])} (${pct}%)</b>. ИИ посчитал точно — и одновременно все ${items.length} бутылок по цветам.`;
    const perShift = Math.round(err * (3600 / C_DUR) * 8);
    $('#r-extra').textContent = err === 0
      ? 'А теперь представьте, что так нужно считать 8 часов подряд — и ещё переносить цифры в журнал.'
      : `Если считать так всю 8-часовую смену, расхождение составит около ${nf0.format(perShift)} ${plural(perShift, ['единицы', 'единиц', 'единиц'])}.`;
    result.hidden = false;
    setStatus('Повтор глазами ИИ · ×1,5', 'ai');
    replayT = 0;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  tapBtn.addEventListener('click', () => add(1));
  undoBtn.addEventListener('click', () => add(-1));
  canvas.addEventListener('click', () => add(1));
  document.addEventListener('keydown', (e) => {
    if (state !== 'run' || e.code !== 'Space' || e.target.closest('input, textarea')) return;
    e.preventDefault();
    if (!e.repeat) add(1);
  });

  $('#g-start-btn').addEventListener('click', start);
  $('#g-again').addEventListener('click', () => {
    state = 'idle';
    $('#game').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(start, 400);
  });

  drawFlow(ctx, items, 2.2, false);
}

/* ================= Hero: бесконечный поток со счётчиком ================= */
function initCountingHero() {
  const canvas = $('#hero-canvas');
  const ctx = setupCanvas(canvas, CW, CH);
  const LEN = 6000;
  const items = makeFlow(LEN, 110, 32);
  const period = (LEN + CW + 70) / BELT_V;
  const perLoop = { blue: 0, teal: 0, green: 0, clear: 0, brown: 0 };
  items.forEach((o) => { perLoop[o.type]++; });
  const start = { blue: 1240, teal: 860, green: 905, clear: 772, brown: 641 };
  let t = 6, loops = 0;

  const draw = () => {
    const base = {};
    Object.keys(perLoop).forEach((k) => { base[k] = start[k] + loops * perLoop[k]; });
    drawFlow(ctx, items, t, true, base);
  };
  draw();
  animateWhileVisible(canvas, (dt) => {
    t += dt;
    if (t >= period) { t -= period; loops++; }
    draw();
  });
}

initCountingHero();
initCountingGame();
