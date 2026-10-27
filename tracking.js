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

/* ================= Игра: уследите за коробками ================= */
// targets — сколько коробок нужно отследить в раунде
const ROUNDS = [
  { cols: 3, boxes: 6, swaps: 5, dur: 6.5, swapT: 0.75, targets: 1 },
  { cols: 4, boxes: 8, swaps: 7, dur: 8, swapT: 0.65, targets: 2 },
  { cols: 4, boxes: 9, swaps: 8, dur: 9, swapT: 0.6, targets: 3 },
];
const TOTAL_TARGETS = ROUNDS.reduce((a, r) => a + r.targets, 0);
const START_X = 50, COL_GAP = 95, TRAVEL = 500, SWAP_FROM = 0.9;

function buildRound(cfg) {
  const slots = shuffle([...Array(cfg.cols * 3).keys()]).slice(0, cfg.boxes);
  const boxes = slots.map((s, k) => ({ id: k + 1, col: Math.floor(s / 3), lane: s % 3, startLane: s % 3, moves: [] }));
  const targets = shuffle([...boxes]).slice(0, cfg.targets);
  const slot = (cfg.dur - SWAP_FROM - 0.6) / cfg.swaps;
  const swapEnds = [];
  for (let k = 0; k < cfg.swaps; k++) {
    const t0 = SWAP_FROM + k * slot + rand(0, Math.max(0, slot - cfg.swapT));
    const t1 = t0 + cfg.swapT;
    // Чаще перемешиваем колонки с «вашими» коробками
    const col = Math.random() < 0.6 ? pick(targets).col : pick(boxes).col;
    const inCol = boxes.filter((b) => b.col === col);
    const mine = inCol.filter((b) => targets.includes(b));
    const a = mine.length && Math.random() < 0.6 ? pick(mine) : pick(inCol);
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
  return { cfg, boxes, targets, swapEnds, v: TRAVEL / cfg.dur };
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
  let picked = new Set(), results = [];

  const setStatus = (text, kind = '') => { status.textContent = text; status.className = 'status' + (kind ? ' status--' + kind : ''); };
  const need = () => round.cfg.targets;
  const boxesWord = (n) => plural(n, ['коробку', 'коробки', 'коробок']);
  const pickStatus = () => (need() === 1
    ? 'Лента остановилась. Где ваша коробка? Нажмите на неё'
    : `Лента остановилась. Найдите свои ${need()} ${boxesWord(need())}: выбрано ${picked.size} из ${need()}`);

  function render(now = 0) {
    drawBelt(ctx, round.v * Math.min(t, round.cfg.dur));
    const pos = new Map(round.boxes.map((b) => [b, boxPos(round, b, t)]));
    pos.forEach(([x, y]) => drawBox(ctx, x, y));
    drawShadow(ctx);

    if (state === 'intro') {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 120);
      round.targets.forEach((b) => {
        const [x, y] = pos.get(b);
        aiFrame(ctx, x, y, '#ffb020', 'СЛЕДИТЕ', '#1a1200');
      });
      ctx.globalAlpha = 1;
    }

    if (state === 'pick') {
      picked.forEach((b) => {
        const [x, y] = pos.get(b);
        aiFrame(ctx, x, y, '#e8edf3', 'ВЫБОР', '#0b0e13');
      });
    }

    if (state === 'reveal') {
      // Траектории ваших коробок — так их «запомнил» ИИ
      ctx.strokeStyle = 'rgba(255,176,32,.9)';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#ffb020';
      round.targets.forEach((tb) => {
        ctx.beginPath();
        for (let s = 0; s <= round.cfg.dur + 0.001; s += 0.04) {
          const [x, y] = boxPos(round, tb, s);
          s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        const [sx, sy] = boxPos(round, tb, 0);
        ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
      });

      pos.forEach(([x, y], b) => {
        if (round.targets.includes(b)) aiFrame(ctx, x, y, '#ffb020', `ID ${pad2(b.id)} · ВАША`, '#1a1200');
        else aiFrame(ctx, x, y, '#2ee6a8', `ID ${pad2(b.id)}`);
      });
      picked.forEach((b) => {
        if (round.targets.includes(b)) return;
        const [x, y] = pos.get(b);
        ctx.strokeStyle = '#ff4d4f';
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 40, y - 40, 80, 80);
        // Крест вместо подписи — подпись налезала на ярлыки соседних коробок
        ctx.beginPath();
        ctx.moveTo(x - 22, y - 22); ctx.lineTo(x + 22, y + 22);
        ctx.moveTo(x + 22, y - 22); ctx.lineTo(x - 22, y + 22);
        ctx.stroke();
      });
      tag(ctx, 16, 40, `ИИ: ${round.boxes.length} треков из ${round.boxes.length} · 0 потерь`, '#2ee6a8', '#06281d', 14);
    }
  }

  function frame(now) {
    if (state === 'intro') {
      t = 0;
      if (now - phaseStart > 2000 + 800 * (need() - 1)) {
        state = 'run';
        phaseStart = now;
        setStatus(need() === 1 ? 'Следите за ней…' : 'Следите за ними…');
      }
    } else if (state === 'run') {
      t = (now - phaseStart) / 1000;
      $('#g-swaps').textContent = round.swapEnds.filter((e) => e <= t).length;
      if (t >= round.cfg.dur) {
        t = round.cfg.dur;
        state = 'pick';
        stage.classList.add('is-clickable');
        setStatus(pickStatus(), 'warn');
      }
    }
    render(now);
    if (state === 'intro' || state === 'run') requestAnimationFrame(frame);
  }

  function beginRound() {
    round = buildRound(ROUNDS[ri]);
    t = 0;
    picked = new Set();
    state = 'intro';
    phaseStart = performance.now();
    $('#g-round').textContent = `${ri + 1}/${ROUNDS.length}`;
    $('#g-swaps').textContent = '0';
    nextBtn.hidden = true;
    stage.classList.remove('is-clickable');
    setStatus(need() === 1 ? 'Запомните коробку в жёлтой рамке' : `Запомните ${need()} ${boxesWord(need())} в жёлтых рамках`, 'warn');
    requestAnimationFrame(frame);
  }

  function evaluate() {
    const hits = [...picked].filter((b) => round.targets.includes(b)).length;
    const n = need();
    score += hits;
    results.push({ hits, need: n, swaps: round.cfg.swaps });
    $('#g-score').textContent = `${score}/${TOTAL_TARGETS}`;
    state = 'reveal';
    stage.classList.remove('is-clickable');
    render();
    const all = hits === n;
    let text;
    if (all) {
      text = n === 1
        ? `Верно! ИИ тоже не ошибся — и при этом помнит все ${round.boxes.length} коробок.`
        : `Все ${n} верно! ИИ тоже не ошибся — и при этом помнит все ${round.boxes.length} коробок.`;
    } else {
      text = n === 1
        ? 'Мимо. Ваша коробка — в жёлтой рамке, линия показывает её путь. ИИ не потерял ни одной.'
        : `Угадано ${hits} из ${n}. Ваши коробки — в жёлтых рамках, линии показывают их путь. ИИ не потерял ни одной.`;
    }
    setStatus(text, all ? 'ai' : 'warn');
    nextBtn.textContent = ri < ROUNDS.length - 1 ? 'Следующий раунд →' : 'Показать результат';
    nextBtn.hidden = false;
  }

  function finish() {
    state = 'done';
    nextBtn.hidden = true;
    setStatus('');
    $('#r-human').textContent = `${score}/${TOTAL_TARGETS}`;
    let copy = score === TOTAL_TARGETS
      ? 'Вы не потеряли ни одной коробки за три раунда — отличная концентрация! ИИ сделал то же самое, но одновременно для каждой коробки на ленте.'
      : `Вы уследили за ${score} из ${TOTAL_TARGETS} коробок. ИИ — за всеми ${TOTAL_TARGETS}, причём одновременно со всеми остальными на ленте.`;
    const miss = results.findIndex((r) => r.hits < r.need);
    if (miss >= 0) {
      const { hits, need: n, swaps } = results[miss];
      const lost = n - hits;
      copy += ` В раунде ${miss + 1} вы потеряли ${lost} ${boxesWord(lost)} после <b>${swaps} ${plural(swaps, ['перестановки', 'перестановок', 'перестановок'])}</b> — на линии сортировки это ${lost === 1 ? 'посылка, уехавшая' : 'посылки, уехавшие'} не тому клиенту.`;
    }
    $('#r-copy').innerHTML = copy;
    $('#r-extra').textContent = 'Уже за тремя коробками следить в разы труднее. А на реальной линии их сотни в минуту — и следить нужно за каждой, всю смену.';
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
    // Повторный клик снимает выбор
    if (picked.has(best)) picked.delete(best); else picked.add(best);
    if (picked.size === need()) return evaluate();
    render();
    setStatus(pickStatus(), 'warn');
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
    $('#g-score').textContent = `0/${TOTAL_TARGETS}`;
    result.hidden = true;
    beginRound();
    $('#game').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('#g-score').textContent = `0/${TOTAL_TARGETS}`;
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
