'use strict';

/* ================= Сцена: конвейер с коробками ================= */
const TW = 960, TH = 540;
const LANES = [175, 270, 365];
const BELT_TOP = 110, BELT_BOTTOM = 430;
const SHADOW = [350, 510]; // затенённый участок под порталом
const BOX = 60;

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const pad2 = (n) => String(n).padStart(2, '0');

function drawBelt(ctx, offset) {
  ctx.fillStyle = '#10151b';
  ctx.fillRect(0, 0, TW, TH);
  ctx.fillStyle = '#20262e';
  ctx.fillRect(0, BELT_TOP, TW, BELT_BOTTOM - BELT_TOP);
  const step = 40, o = offset % step;
  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = o - step; x < TW; x += step) { ctx.moveTo(x, BELT_TOP); ctx.lineTo(x, BELT_BOTTOM); }
  ctx.stroke();
  ctx.fillStyle = '#3a4452';
  ctx.fillRect(0, BELT_TOP - 12, TW, 12);
  ctx.fillRect(0, BELT_BOTTOM, TW, 12);
}

function drawShadow(ctx) {
  const [a, b] = SHADOW;
  const g = ctx.createLinearGradient(a, 0, b, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.2, 'rgba(0,0,0,.6)');
  g.addColorStop(0.8, 'rgba(0,0,0,.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(a, BELT_TOP - 12, b - a, BELT_BOTTOM - BELT_TOP + 24);
  ctx.fillStyle = '#2a323d';
  ctx.fillRect(a + 30, BELT_TOP - 44, b - a - 60, 24);
  ctx.fillRect(a + 30, BELT_BOTTOM + 20, b - a - 60, 24);
}

function drawBox(ctx, x, y) {
  const h = BOX / 2;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(x - h + 4, y - h + 5, BOX, BOX);
  ctx.fillStyle = '#b4874f';
  ctx.fillRect(x - h, y - h, BOX, BOX);
  ctx.fillStyle = '#c3955b';
  ctx.fillRect(x - h, y - h, BOX, h);
  ctx.fillStyle = '#d9c19a';
  ctx.fillRect(x - 5, y - h, 10, BOX);
  ctx.strokeStyle = '#7d5a30';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - h + 0.75, y - h + 0.75, BOX - 1.5, BOX - 1.5);
}

function aiFrame(ctx, x, y, color, label, fg = '#06281d') {
  const s = BOX + 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - s / 2, y - s / 2, s, s);
  if (label) tag(ctx, x - s / 2, y - s / 2, label, color, fg, 12);
}

/* ================= Игра: уследите за коробкой ================= */
const ROUNDS = [
  { cols: 3, boxes: 6, swaps: 5, dur: 6.5, swapT: 0.75 },
  { cols: 4, boxes: 8, swaps: 8, dur: 7.5, swapT: 0.6 },
  { cols: 4, boxes: 10, swaps: 12, dur: 8.5, swapT: 0.5 },
];
const START_X = 50, COL_GAP = 95, TRAVEL = 500, SWAP_FROM = 0.9;

function buildRound(cfg) {
  const slots = shuffle([...Array(cfg.cols * 3).keys()]).slice(0, cfg.boxes);
  const boxes = slots.map((s, k) => ({ id: k + 1, col: Math.floor(s / 3), lane: s % 3, startLane: s % 3, moves: [] }));
  const target = pick(boxes);
  const slot = (cfg.dur - SWAP_FROM - 0.6) / cfg.swaps;
  const swapEnds = [];
  for (let k = 0; k < cfg.swaps; k++) {
    const t0 = SWAP_FROM + k * slot + rand(0, Math.max(0, slot - cfg.swapT));
    const t1 = t0 + cfg.swapT;
    // Чаще перемешиваем колонку с «вашей» коробкой
    const col = Math.random() < 0.6 ? target.col : pick(boxes).col;
    const inCol = boxes.filter((b) => b.col === col);
    const a = inCol.includes(target) && Math.random() < 0.6 ? target : pick(inCol);
    const toLane = pick([0, 1, 2].filter((l) => l !== a.lane));
    const b = inCol.find((x) => x.lane === toLane);
    const side = Math.random() < 0.5 ? 1 : -1;
    a.moves.push({ t0, t1, from: a.lane, to: toLane, side });
    if (b) {
      b.moves.push({ t0, t1, from: toLane, to: a.lane, side: -side });
      b.lane = a.lane;
    }
    a.lane = toLane;
    swapEnds.push(t1);
  }
  return { cfg, boxes, target, swapEnds, v: TRAVEL / cfg.dur };
}

function boxPos(round, b, t) {
  const x = START_X + b.col * COL_GAP + round.v * Math.min(t, round.cfg.dur);
  let y = LANES[b.startLane], dx = 0;
  for (const m of b.moves) {
    if (t >= m.t1) { y = LANES[m.to]; continue; }
    if (t > m.t0) {
      const p = ease((t - m.t0) / (m.t1 - m.t0));
      y = LANES[m.from] + (LANES[m.to] - LANES[m.from]) * p;
      dx = Math.sin(Math.PI * p) * 22 * m.side;
    }
    break;
  }
  return [x + dx, y];
}

function initTrackingGame() {
  const canvas = $('#g-canvas');
  const ctx = setupCanvas(canvas, TW, TH);
  const stage = $('#stage');
  const status = $('#g-status');
  const nextBtn = $('#g-next');
  const result = $('#g-result');

  let state = 'idle', ri = 0, round = buildRound(ROUNDS[0]), t = 0, phaseStart = 0, score = 0;
  let picked = null, results = [];

  const setStatus = (text, kind = '') => { status.textContent = text; status.className = 'status' + (kind ? ' status--' + kind : ''); };

  function render(now = 0) {
    drawBelt(ctx, round.v * Math.min(t, round.cfg.dur));
    const pos = new Map(round.boxes.map((b) => [b, boxPos(round, b, t)]));
    pos.forEach(([x, y]) => drawBox(ctx, x, y));
    drawShadow(ctx);

    if (state === 'intro') {
      const [x, y] = pos.get(round.target);
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 120);
      aiFrame(ctx, x, y, '#ffb020', 'СЛЕДИТЕ', '#1a1200');
      ctx.globalAlpha = 1;
    }

    if (state === 'reveal') {
      // Траектория вашей коробки — так её «запомнил» ИИ
      ctx.strokeStyle = 'rgba(255,176,32,.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let s = 0; s <= round.cfg.dur + 0.001; s += 0.04) {
        const [x, y] = boxPos(round, round.target, s);
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      const [sx, sy] = boxPos(round, round.target, 0);
      ctx.fillStyle = '#ffb020';
      ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();

      pos.forEach(([x, y], b) => {
        if (b === round.target) aiFrame(ctx, x, y, '#ffb020', `ID ${pad2(b.id)} · ВАША`, '#1a1200');
        else aiFrame(ctx, x, y, '#2ee6a8', `ID ${pad2(b.id)}`);
      });
      if (picked && picked !== round.target) {
        const [x, y] = pos.get(picked);
        ctx.strokeStyle = '#ff4d4f';
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 40, y - 40, 80, 80);
        tag(ctx, x - 40, y + 58, 'ВАШ ВЫБОР', '#ff4d4f', '#fff', 12);
      }
      tag(ctx, 16, 40, `ИИ: ${round.boxes.length} треков из ${round.boxes.length} · 0 потерь`, '#2ee6a8', '#06281d', 14);
    }
  }

  function frame(now) {
    if (state === 'intro') {
      t = 0;
      if (now - phaseStart > 2000) {
        state = 'run';
        phaseStart = now;
        setStatus('Следите за ней…');
      }
    } else if (state === 'run') {
      t = (now - phaseStart) / 1000;
      $('#g-swaps').textContent = round.swapEnds.filter((e) => e <= t).length;
      if (t >= round.cfg.dur) {
        t = round.cfg.dur;
        state = 'pick';
        stage.classList.add('is-clickable');
        setStatus('Лента остановилась. Где ваша коробка? Нажмите на неё', 'warn');
      }
    }
    render(now);
    if (state === 'intro' || state === 'run') requestAnimationFrame(frame);
  }

  function beginRound() {
    round = buildRound(ROUNDS[ri]);
    t = 0;
    picked = null;
    state = 'intro';
    phaseStart = performance.now();
    $('#g-round').textContent = `${ri + 1}/${ROUNDS.length}`;
    $('#g-swaps').textContent = '0';
    nextBtn.hidden = true;
    stage.classList.remove('is-clickable');
    setStatus('Запомните коробку в жёлтой рамке', 'warn');
    requestAnimationFrame(frame);
  }

  function finish() {
    state = 'done';
    nextBtn.hidden = true;
    setStatus('');
    const total = ROUNDS[ROUNDS.length - 1].boxes;
    $('#r-human').textContent = `${score}/${ROUNDS.length}`;
    let copy = score === ROUNDS.length
      ? 'Вы уследили за коробкой во всех трёх раундах — отличная концентрация! ИИ сделал то же самое, но одновременно для каждой коробки на ленте.'
      : `Вы уследили за коробкой в ${score} из ${ROUNDS.length} раундов. ИИ — во всех трёх, причём сразу за всеми ${total} коробками.`;
    const miss = results.findIndex((r) => !r.ok);
    if (miss >= 0) {
      const n = results[miss].swaps;
      copy += ` В раунде ${miss + 1} коробка потерялась после <b>${n} ${plural(n, ['перестановки', 'перестановок', 'перестановок'])}</b> — на линии сортировки это посылка, уехавшая не тому клиенту.`;
    }
    $('#r-copy').innerHTML = copy;
    $('#r-extra').textContent = 'А на реальной линии таких коробок — сотни в минуту, и следить нужно за каждой, всю смену.';
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  canvas.addEventListener('click', (e) => {
    if (state !== 'pick') return;
    const [cx, cy] = canvasPoint(canvas, e, TW, TH);
    let best = null, bestD = 52;
    round.boxes.forEach((b) => {
      const [x, y] = boxPos(round, b, t);
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestD) { best = b; bestD = d; }
    });
    if (!best) return;
    picked = best;
    const ok = best === round.target;
    if (ok) score++;
    results.push({ ok, swaps: round.cfg.swaps });
    $('#g-score').textContent = score;
    state = 'reveal';
    stage.classList.remove('is-clickable');
    render();
    setStatus(ok
      ? `Верно! ИИ тоже не ошибся — и при этом помнит все ${round.boxes.length} коробок.`
      : 'Мимо. Ваша коробка — в жёлтой рамке, линия показывает её путь. ИИ не потерял ни одной.', ok ? 'ai' : 'warn');
    nextBtn.textContent = ri < ROUNDS.length - 1 ? 'Следующий раунд →' : 'Показать результат';
    nextBtn.hidden = false;
  });

  nextBtn.addEventListener('click', () => {
    if (ri < ROUNDS.length - 1) { ri++; beginRound(); } else finish();
  });

  $('#g-start-btn').addEventListener('click', () => {
    $('#g-start').hidden = true;
    beginRound();
  });

  $('#g-again').addEventListener('click', () => {
    ri = 0; score = 0; results = [];
    $('#g-score').textContent = '0';
    result.hidden = true;
    beginRound();
    $('#game').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  render();
}

/* ================= Hero: непрерывный трекинг ================= */
function initTrackingHero() {
  const canvas = $('#hero-canvas');
  const ctx = setupCanvas(canvas, TW, TH);
  const v = 110;
  const boxes = [];
  let offset = 0, spawnIn = 0, nextId = 4811;

  const free = (lane, x, self) => boxes.every((b) => b === self || Math.abs(b.x - x) > 90 || (b.lane !== lane && b.to !== lane));

  function update(dt) {
    offset += v * dt;
    spawnIn -= dt;
    if (spawnIn <= 0) {
      const lanes = [0, 1, 2].filter((l) => free(l, -40));
      if (lanes.length) {
        const lane = pick(lanes);
        boxes.push({ id: nextId++, x: -40, lane, to: null, p: 0, y: LANES[lane], trail: [] });
      }
      spawnIn = rand(0.7, 1.4);
    }
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      b.x += v * dt;
      if (b.to !== null) {
        b.p = Math.min(1, b.p + dt / 0.9);
        b.y = LANES[b.lane] + (LANES[b.to] - LANES[b.lane]) * ease(b.p);
        if (b.p >= 1) { b.lane = b.to; b.to = null; }
      } else if (b.x > 100 && b.x < 760 && Math.random() < dt * 0.2) {
        const opts = [b.lane - 1, b.lane + 1].filter((l) => l >= 0 && l < 3 && free(l, b.x, b));
        if (opts.length) { b.to = pick(opts); b.p = 0; }
      }
      b.trail.push([b.x, b.y]);
      if (b.trail.length > 80) b.trail.shift();
      if (b.x > TW + 60) boxes.splice(i, 1);
    }
  }

  function draw() {
    drawBelt(ctx, offset);
    boxes.forEach((b) => drawBox(ctx, b.x, b.y));
    drawShadow(ctx);
    ctx.lineWidth = 2;
    boxes.forEach((b) => {
      ctx.strokeStyle = 'rgba(46,230,168,.45)';
      ctx.beginPath();
      b.trail.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      aiFrame(ctx, b.x, b.y, '#2ee6a8', `ID ${b.id}`);
    });
    tag(ctx, 16, 40, `ОТСЛЕЖИВАЕТСЯ: ${boxes.length}`, '#2ee6a8', '#06281d', 14);
    tag(ctx, 16, 66, 'ПОТЕРЯНО: 0', 'rgba(20,26,34,.9)', '#2ee6a8', 14);
  }

  for (let k = 0; k < 300; k++) update(1 / 30);
  draw();
  animateWhileVisible(canvas, (dt) => { update(dt); draw(); });
}

initTrackingHero();
initTrackingGame();
