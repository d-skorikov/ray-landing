'use strict';

/* ================= Сцена: ночная камера склада ================= */
const MW = 960, MH = 540, M_DUR = 25;
const hash = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
const lerp = (a, b, p) => a + (b - a) * p;
const clamp01 = (p) => Math.max(0, Math.min(1, p));
const SHELF_F = [60, 180, 300, 420], SHELF_B = [128, 172, 216, 260];

function poly(g, pts, fill) {
  g.beginPath();
  pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

function makeBackground() {
  const c = document.createElement('canvas');
  c.width = MW; c.height = MH;
  const g = c.getContext('2d');
  g.fillStyle = '#0f1611'; g.fillRect(0, 0, MW, MH);
  poly(g, [[0, 0], [MW, 0], [630, 120], [330, 120]], '#090e0a');
  g.fillStyle = '#18211a'; g.fillRect(330, 120, 300, 142);
  poly(g, [[0, MH], [MW, MH], [630, 262], [330, 262]], '#1a241c');
  g.strokeStyle = 'rgba(120,160,130,.05)'; g.lineWidth = 2;
  for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(480 + k * 50, 262); g.lineTo(480 + k * 230, MH); g.stroke(); }

  // Стеллажи слева и справа
  [[0, 330], [MW, 630]].forEach(([front, back]) => {
    poly(g, [[front, 40], [back, 125], [back, 262], [front, 500]], '#141d17');
    g.strokeStyle = '#1e2a21'; g.lineWidth = 3;
    SHELF_F.forEach((yf, s) => { g.beginPath(); g.moveTo(front, yf); g.lineTo(back, SHELF_B[s]); g.stroke(); });
    for (let s = 0; s < 3; s++) {
      for (let k = 0; k < 4; k++) {
        const p = 0.12 + k * 0.22 + hash(s * 7 + k + front) * 0.05;
        if (front === 0 && s === 1 && k === 2) continue; // место упавшей коробки
        const x = lerp(front, back, p), y = lerp(SHELF_F[s + 1], SHELF_B[s + 1], p), sc = lerp(1, 0.45, p);
        const w = 52 * sc, h = 40 * sc;
        g.fillStyle = '#1e2a21'; g.strokeStyle = '#2a382e'; g.lineWidth = 1;
        const bx = front === 0 ? x : x - w;
        g.fillRect(bx, y - h - 3, w, h); g.strokeRect(bx, y - h - 3, w, h);
      }
    }
  });
  // Дверь и окно в дальней стене
  g.fillStyle = '#0f1611'; g.fillRect(520, 160, 56, 100);
  g.strokeStyle = '#2a372d'; g.lineWidth = 2; g.strokeRect(520, 160, 56, 100);
  g.fillStyle = '#16211a'; g.fillRect(360, 140, 100, 60);
  g.strokeRect(360, 140, 100, 60);
  g.beginPath(); g.moveTo(410, 140); g.lineTo(410, 200); g.stroke();
  g.fillStyle = '#1d2820'; g.fillRect(462, 14, 36, 10);

  // Виньетка
  const v = g.createRadialGradient(480, 270, 200, 480, 270, 620);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = v; g.fillRect(0, 0, MW, MH);
  return c;
}

function makeNoise(n) {
  return [...Array(n)].map(() => {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 135;
    const g = c.getContext('2d');
    const img = g.createImageData(240, 135);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v * 0.8; img.data[i + 1] = v; img.data[i + 2] = v * 0.85; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

// События: draw(ctx, lt) рисует состояние в локальном времени lt (может быть <0 или > dur), box(lt) — рамка для ИИ и попадания
const SIL = 'rgba(150,190,160,';
const M_EVENTS = {
  person: {
    name: 'Человек в проходе', label: 'ЧЕЛОВЕК', dur: 4.5,
    x: (lt) => lerp(420, 560, clamp01(lt / 4.5)),
    draw(ctx, lt) {
      if (lt < 0 || lt > this.dur) return;
      const x = this.x(lt), fy = 300, ph = Math.sin(lt * 7);
      ctx.fillStyle = SIL + '.2)'; ctx.strokeStyle = SIL + '.2)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, fy - 56, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - 9, fy - 48, 18, 28);
      ctx.beginPath(); ctx.moveTo(x - 4, fy - 22); ctx.lineTo(x - 4 + ph * 6, fy); ctx.moveTo(x + 4, fy - 22); ctx.lineTo(x + 4 - ph * 6, fy); ctx.stroke();
    },
    box(lt) { const x = this.x(lt); return [x - 16, 236, 32, 68]; },
  },
  door: {
    name: 'Открылась дверь', label: 'ДВЕРЬ', dur: 3.5,
    draw(ctx, lt) {
      if (lt < 0 || lt > this.dur) return;
      const open = lt < 1.2 ? lt / 1.2 : lt > this.dur - 0.8 ? (this.dur - lt) / 0.8 : 1;
      const w = 28 * clamp01(open);
      ctx.fillStyle = 'rgba(170,215,185,.14)'; ctx.fillRect(522, 162, w, 96);
      ctx.fillStyle = 'rgba(170,215,185,.05)';
      poly(ctx, [[522, 260], [522 + w, 260], [540 + w * 2.2, 300], [515, 300]], 'rgba(170,215,185,.05)');
    },
    box() { return [512, 152, 72, 116]; },
  },
  box: {
    name: 'Упала коробка', label: 'ПРЕДМЕТ', dur: 2.5,
    pos(lt) {
      if (lt <= 0) return [192, 147, 0];
      if (lt < 0.5) return [lerp(192, 214, lt / 0.5), 147, 0];
      if (lt < 1.1) { const p = (lt - 0.5) / 0.6; return [lerp(214, 240, p), lerp(147, 340, p * p), 0.6 * p]; }
      return [240, 340, 0.6];
    },
    draw(ctx, lt) {
      const [x, y, r] = this.pos(lt);
      ctx.save(); ctx.translate(x + 16, y + 13); ctx.rotate(r);
      ctx.fillStyle = '#1c271f'; ctx.strokeStyle = '#26332a'; ctx.lineWidth = 1;
      ctx.fillRect(-16, -13, 32, 26); ctx.strokeRect(-16, -13, 32, 26);
      ctx.restore();
    },
    box(lt) { const [x, y] = this.pos(Math.min(lt, this.dur)); return [x - 8, y - 8, 50, 44]; },
  },
  rat: {
    name: 'Грызун у стены', label: 'ЖИВОТНОЕ', dur: 1.6,
    p: (lt) => [lerp(930, 715, clamp01(lt / 1.6)), lerp(515, 335, clamp01(lt / 1.6))],
    draw(ctx, lt) {
      if (lt < 0 || lt > this.dur) return;
      const [x, y] = this.p(lt);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(-180, -215));
      ctx.fillStyle = SIL + '.32)';
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = SIL + '.25)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-24, 3); ctx.stroke();
      ctx.restore();
    },
    box(lt) { const [x, y] = this.p(lt); return [x - 18, y - 14, 36, 28]; },
  },
  peek: {
    name: 'Человек за стеллажом', label: 'ЧЕЛОВЕК', dur: 3.6,
    x(lt) { return 985 - 80 * Math.sin(Math.PI * clamp01(lt / this.dur)); },
    draw(ctx, lt) {
      if (lt < 0 || lt > this.dur) return;
      const x = this.x(lt);
      ctx.fillStyle = SIL + '.13)';
      ctx.beginPath(); ctx.arc(x, 318, 17, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(x - 32, 342, 64, 140, 18); ctx.fill();
    },
    box(lt) { const x = this.x(lt); return [x - 40, 292, 80, 196]; },
  },
};

function makeScene(canvas) {
  const ctx = setupCanvas(canvas, MW, MH);
  const bg = makeBackground();
  const noise = makeNoise(4);

  // Мерцание лампы и дождь — шум, на который ИИ не реагирует
  function render(t, schedule, ai = false, markers = []) {
    ctx.drawImage(bg, 0, 0, MW, MH);
    const flick = hash(Math.floor(t * 9)) > 0.72 ? 0.07 : 0.03 + hash(Math.floor(t * 30)) * 0.01;
    poly(ctx, [[455, 24], [505, 24], [640, 262], [320, 262]], `rgba(190,230,200,${flick})`);
    ctx.save();
    ctx.beginPath(); ctx.rect(361, 141, 98, 58); ctx.clip();
    ctx.strokeStyle = 'rgba(190,225,200,.22)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const x = 360 + ((k * 37 + t * 40) % 110), y = 140 + ((k * 53 + t * 260) % 70);
      ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9);
    }
    ctx.stroke(); ctx.restore();

    schedule.forEach((ev) => M_EVENTS[ev.type].draw(ctx, t - ev.start));

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.055;
    ctx.drawImage(noise[Math.floor(t * 24) % noise.length], 0, 0, MW, MH);
    ctx.restore();

    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(200,230,210,.75)';
    const sec = 47 + Math.floor(t);
    ctx.fillText(`CAM-04 · СКЛАД №2 · 02:${13 + Math.floor(sec / 60)}:${pad(sec % 60)}`, 20, 32);
    if (Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = '#ff4d4f'; ctx.beginPath(); ctx.arc(MW - 70, 27, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(200,230,210,.75)'; ctx.fillText('REC', MW - 56, 32);

    if (ai) {
      ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(180,190,200,.5)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(440, 18, 80, 60); ctx.strokeRect(356, 136, 108, 68);
      ctx.setLineDash([]);
      tag(ctx, 440, 96, 'МЕРЦАНИЕ · ИГНОР', 'rgba(60,70,80,.85)', '#c9d3dd', 11);
      tag(ctx, 356, 222, 'ДОЖДЬ · ИГНОР', 'rgba(60,70,80,.85)', '#c9d3dd', 11);
      let n = 0;
      schedule.forEach((ev) => {
        const E = M_EVENTS[ev.type], lt = t - ev.start;
        if (lt < 0 || lt > E.dur) return;
        n++;
        const [x, y, w, h] = E.box(lt);
        ctx.strokeStyle = '#ff4d4f'; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, w, h);
        tag(ctx, x, y, `${E.label} · ${ev.conf}%`, '#ff4d4f', '#fff', 12);
      });
      tag(ctx, 20, 64, n ? `ИИ · ДВИЖЕНИЕ: ${n}` : 'ИИ · СЦЕНА СПОКОЙНА', n ? '#ff4d4f' : '#2ee6a8', n ? '#fff' : '#06281d', 13);
    }

    markers.forEach((m) => {
      const age = t - m.t;
      if (age < 0 || age > 0.8) return;
      ctx.globalAlpha = 1 - age / 0.8;
      ctx.strokeStyle = m.hit ? '#2ee6a8' : '#93a1b3'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(m.x, m.y, 18 + age * 30, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }
  return render;
}

const pad = (n) => String(n).padStart(2, '0');

function makeSchedule() {
  return shuffle(Object.keys(M_EVENTS)).map((type, i) => ({
    type, start: 2 + i * 4.3 + rand(0, 1.3), conf: rand(91, 99).toFixed(1).replace('.', ','),
  }));
}

/* ================= Игра: заметите движение? ================= */
function initMotionGame() {
  const canvas = $('#g-canvas');
  const render = makeScene(canvas);
  const stage = $('#stage');
  const status = $('#g-status');
  const result = $('#g-result');
  const timerEl = $('#g-timer'), hitsEl = $('#g-hits'), falseEl = $('#g-false'), progress = $('#g-progress');

  let state = 'idle', schedule = makeSchedule(), t0 = 0, t = 0, markers = [], found = new Map(), falses = 0, replayT = 0, last = 0;

  const setStatus = (text, kind = '') => { status.textContent = text; status.className = 'status' + (kind ? ' status--' + kind : ''); };

  function frame(now) {
    if (state === 'run') {
      t = (now - t0) / 1000;
      const left = Math.max(0, M_DUR - t);
      timerEl.textContent = left.toFixed(1).replace('.', ',') + ' с';
      progress.style.transform = `scaleX(${left / M_DUR})`;
      render(t, schedule, false, markers);
      if (left <= 0) return finish();
    } else if (state === 'replay') {
      replayT = (replayT + Math.min((now - last) / 1000, 0.05) * 2) % M_DUR;
      last = now;
      render(replayT, schedule, true);
    } else return;
    requestAnimationFrame(frame);
  }

  function start() {
    $('#g-start').hidden = true;
    schedule = makeSchedule();
    markers = []; found = new Map(); falses = 0;
    hitsEl.textContent = '0'; falseEl.textContent = '0';
    result.hidden = true;
    state = 'run';
    stage.classList.add('is-clickable');
    setStatus('Нажимайте на место, где заметили движение');
    t0 = performance.now();
    requestAnimationFrame(frame);
  }

  function finish() {
    state = 'replay';
    stage.classList.remove('is-clickable');
    timerEl.textContent = '0,0 с';
    const total = schedule.length, hits = found.size;
    const times = [...found.values()];
    const avg = hits ? (times.reduce((a, b) => a + b, 0) / hits).toFixed(1).replace('.', ',') : '';
    $('#r-human').textContent = `${hits}/${total}`;
    let copy = `Вы заметили ${hits} из ${total} событий${hits ? `, в среднем через ${avg} с` : ''}. ИИ — ${total} из ${total}, каждое за 0,04 с.`;
    const missed = schedule.filter((ev) => !found.has(ev));
    if (missed.length) copy += ` Пропущено: <b>${missed.map((ev) => M_EVENTS[ev.type].name.toLowerCase()).join(', ')}</b>.`;
    $('#r-copy').innerHTML = copy;
    $('#r-extra').textContent = falses
      ? `Ещё ${falses} ${plural(falses, ['раз', 'раза', 'раз'])} вы среагировали на шум или пустое место — для охраны это ложные выезды.`
      : 'И это 25 секунд одной камеры. У оператора их десятки — и смена 12 часов.';
    const rows = [...schedule].sort((a, b) => a.start - b.start).map((ev) => {
      const rt = found.get(ev);
      const human = rt === undefined ? '<span class="mono t-miss">пропущено</span>' : `<span class="mono t-hit">${rt.toFixed(1).replace('.', ',')} с</span>`;
      return `<li><span>${M_EVENTS[ev.type].name}</span>${human}<span class="mono t-ai">0,04 с</span></li>`;
    });
    $('#r-timeline').innerHTML = '<li class="timeline__head"><span>Событие</span><span class="mono">Вы</span><span class="mono">ИИ</span></li>' + rows.join('');
    result.hidden = false;
    setStatus('Повтор глазами ИИ · ×2', 'ai');
    replayT = 0;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('click', (e) => {
    if (state !== 'run') return;
    const [x, y] = canvasPoint(canvas, e, MW, MH);
    const ev = schedule.find((s) => {
      const E = M_EVENTS[s.type], lt = t - s.start;
      if (found.has(s) || lt < 0 || lt > E.dur + 0.8) return false;
      const [bx, by, bw, bh] = E.box(Math.min(lt, E.dur));
      return x > bx - 36 && x < bx + bw + 36 && y > by - 36 && y < by + bh + 36;
    });
    if (ev) {
      found.set(ev, t - ev.start);
      hitsEl.textContent = found.size;
    } else {
      falses++;
      falseEl.textContent = falses;
    }
    markers.push({ x, y, t, hit: !!ev });
  });

  $('#g-start-btn').addEventListener('click', start);
  $('#g-again').addEventListener('click', () => {
    state = 'idle';
    $('#game').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(start, 400);
  });

  render(0, schedule);
}

/* ================= Hero: ИИ следит за камерой ================= */
function initMotionHero() {
  const canvas = $('#hero-canvas');
  const render = makeScene(canvas);
  const PERIOD = 18;
  const schedule = [
    { type: 'person', start: 1, conf: '97,8' },
    { type: 'door', start: 5.5, conf: '95,1' },
    { type: 'box', start: 9.5, conf: '93,6' },
    { type: 'rat', start: 12.5, conf: '91,4' },
    { type: 'peek', start: 14, conf: '96,2' },
  ];
  let t = 0;
  render(t, schedule, true);
  animateWhileVisible(canvas, (dt) => {
    t = (t + dt) % PERIOD;
    render(t, schedule, true);
  });
}

initMotionHero();
initMotionGame();
