'use strict';

/* ================= Игра «Человек vs ИИ» ================= */
const GAME_TIME = 15;
const PARTS = 40;
const DEFECTS = 10;
const TYPES = ['crack', 'chip', 'hole', 'rust', 'scratch'];
const LABELS = { crack: 'Трещина', chip: 'Скол', hole: 'Нет отв.', rust: 'Пятно', scratch: 'Царапина' };
const HOLE_ANGLES = [0, 60, 120, 180, 240, 300];

function partSVG(i, type) {
  const rot = Math.round(rand(0, 360));
  const grad = pick(['m0', 'm1', 'm2']);
  const missingHole = type === 'hole' ? Math.floor(rand(0, 6)) : -1;
  const a = rand(0, 360);

  let maskHoles = '<circle cx="50" cy="50" r="11"/>';
  let outlines = '<circle cx="50" cy="50" r="11" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="2"/>';
  HOLE_ANGLES.forEach((deg, k) => {
    if (k === missingHole) return;
    const [x, y] = polar(25, deg);
    maskHoles += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4.5"/>`;
    outlines += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4.5" fill="none" stroke="rgba(0,0,0,.45)"/>`;
  });

  let defect = '';
  if (type === 'chip') {
    const [x, y] = polar(43, a);
    maskHoles += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5"/>`;
  } else if (type === 'crack') {
    let d = `M${pt(polar(41.5, a))}`;
    let r = 41.5, ang = a;
    for (let s = 0; s < 4; s++) {
      r -= rand(3, 4.5);
      ang += rand(-9, 9);
      d += ` L${pt(polar(r, ang))}`;
    }
    defect = `<path d="${d}" fill="none" stroke="#1b1f25" stroke-width="1.2" stroke-linejoin="round"/>`;
  } else if (type === 'rust') {
    const [x, y] = polar(rand(28, 34), a);
    defect = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="url(#rust)"/>`;
  } else if (type === 'scratch') {
    const p1 = polar(rand(16, 22), a);
    const p2 = polar(rand(34, 38), a + rand(25, 45));
    defect = `<path d="M${pt(p1)} L${pt(p2)}" stroke="rgba(255,255,255,.85)" stroke-width=".9"/>` +
      `<path d="M${p1[0] + 0.7} ${p1[1] + 0.7} L${p2[0] + 0.7} ${p2[1] + 0.7}" stroke="rgba(30,34,40,.5)" stroke-width=".6"/>`;
  }

  // «Шум» — пылинки на части деталей, чтобы брак не бросался в глаза
  let dust = '';
  if (Math.random() < 0.4) {
    for (let k = 0; k < 3; k++) {
      const [x, y] = polar(rand(14, 38), rand(0, 360));
      dust += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rand(0.5, 0.9).toFixed(2)}" fill="rgba(40,46,54,.55)"/>`;
    }
  }

  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="k${i}"><rect width="100" height="100" fill="#fff"/><g fill="#000" transform="rotate(${rot} 50 50)">${maskHoles}</g></mask></defs>` +
    `<g mask="url(#k${i})"><g transform="rotate(${rot} 50 50)">` +
    `<circle cx="50" cy="50" r="42" fill="url(#${grad})"/>` +
    `<circle cx="50" cy="50" r="41.5" fill="none" stroke="rgba(255,255,255,.3)"/>` +
    `<circle cx="50" cy="50" r="33" fill="none" stroke="rgba(0,0,0,.22)"/>` +
    `${defect}${dust}${outlines}</g></g></svg>`;
}

function initGame() {
  const game = $('#game');
  const board = $('#board');
  const timerEl = $('#g-timer');
  const markedEl = $('#g-marked');
  const progress = $('#g-progress');
  const doneBtn = $('#g-done');
  const startOverlay = $('#g-start');
  const scanline = $('#scanline');
  const result = $('#g-result');

  let state = 'idle';
  let defects = new Map(); // индекс -> тип
  let marked = new Set();
  let t0 = 0;
  let raf = 0;

  function newRound() {
    const idx = shuffle([...Array(PARTS).keys()]).slice(0, DEFECTS);
    const types = shuffle([...TYPES, ...TYPES]);
    defects = new Map(idx.map((v, k) => [v, types[k]]));
    marked = new Set();
    let html = '';
    for (let i = 0; i < PARTS; i++) {
      html += `<button class="cell" type="button" data-i="${i}" aria-label="Деталь ${i + 1}" aria-pressed="false">${partSVG(i, defects.get(i))}</button>`;
    }
    board.innerHTML = html;
    board.classList.add('is-locked');
    markedEl.textContent = '0';
    timerEl.textContent = '15,0 с';
    progress.style.transform = 'scaleX(1)';
    game.classList.remove('is-urgent');
    doneBtn.disabled = true;
    result.hidden = true;
    startOverlay.hidden = false;
    state = 'idle';
  }

  function start() {
    startOverlay.hidden = true;
    board.classList.remove('is-locked');
    doneBtn.disabled = false;
    state = 'playing';
    t0 = performance.now();
    raf = requestAnimationFrame(tick);
    board.querySelector('.cell')?.focus({ preventScroll: true });
  }

  function tick(now) {
    const elapsed = (now - t0) / 1000;
    const left = Math.max(0, GAME_TIME - elapsed);
    timerEl.textContent = left.toFixed(1).replace('.', ',') + ' с';
    progress.style.transform = `scaleX(${left / GAME_TIME})`;
    game.classList.toggle('is-urgent', left < 5);
    if (left <= 0) return finish(GAME_TIME);
    raf = requestAnimationFrame(tick);
  }

  function finish(elapsed) {
    if (state !== 'playing') return;
    cancelAnimationFrame(raf);
    state = 'done';
    board.classList.add('is-locked');
    doneBtn.disabled = true;

    // «Сканирование» ИИ
    scanline.style.setProperty('--h', board.offsetHeight + 'px');
    scanline.classList.remove('is-run');
    void scanline.offsetWidth;
    scanline.classList.add('is-run');

    setTimeout(() => reveal(elapsed), 700);
  }

  function reveal(elapsed) {
    let hits = 0, falses = 0;
    $$('.cell', board).forEach((cell) => {
      const i = +cell.dataset.i;
      const type = defects.get(i);
      const isMarked = marked.has(i);
      if (type) {
        const conf = rand(93, 99.6).toFixed(1).replace('.', ',');
        cell.classList.add(isMarked ? 'r-hit' : 'r-miss');
        cell.insertAdjacentHTML('beforeend', `<span class="cell__tag" title="${LABELS[type]} · ${conf}%">${LABELS[type]}</span>`);
        if (isMarked) hits++;
      } else if (isMarked) {
        cell.classList.add('r-false');
        falses++;
      }
    });

    const missed = DEFECTS - hits;
    const secs = elapsed.toFixed(1).replace('.', ',');
    $('#r-human').textContent = `${hits}/${DEFECTS}`;

    let copy = `Вы потратили ${secs} секунды. ИИ справился за 0,03 секунды.`;
    if (missed > 0) {
      copy += ` Вы пропустили <b>${missed} ${plural(missed, ['дефект', 'дефекта', 'дефектов'])}</b> — это ${missed} ${plural(missed, ['возврат', 'возврата', 'возвратов'])} от клиентов.`;
    } else {
      copy += ' Вы нашли все 10 — отличный результат!';
    }
    $('#r-copy').innerHTML = copy;

    let extra = missed === 0
      ? 'А теперь представьте, что такой темп нужно держать 8 часов подряд — на каждой из тысяч деталей.'
      : 'И это всего 40 деталей при полной концентрации. На линии их тысячи за смену.';
    if (falses > 0) {
      extra += ` Ещё ${falses} ${plural(falses, ['годную деталь', 'годные детали', 'годных деталей'])} вы отправили в брак — это тоже деньги.`;
    }
    $('#r-extra').textContent = extra;

    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  board.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || state !== 'playing') return;
    const i = +cell.dataset.i;
    if (marked.has(i)) marked.delete(i); else marked.add(i);
    const on = marked.has(i);
    cell.classList.toggle('is-marked', on);
    cell.setAttribute('aria-pressed', on);
    markedEl.textContent = marked.size;
  });

  $('#g-start-btn').addEventListener('click', start);
  doneBtn.addEventListener('click', () => finish((performance.now() - t0) / 1000));
  $('#g-again').addEventListener('click', () => {
    newRound();
    game.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  newRound();
}

/* ================= Калькулятор потерь ================= */
function initCalc() {
  const form = $('#calc-form');
  const fields = {};

  const setFill = (range) => {
    const p = ((range.value - range.min) / (range.max - range.min)) * 100;
    range.style.setProperty('--p', p + '%');
  };
  const readNum = (input) => {
    const v = parseFloat(String(input.value).replace(',', '.'));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };

  $$('.q__ctrl[data-field]', form).forEach((ctrl) => {
    const range = $('input[type=range]', ctrl);
    const num = $('input[type=number]', ctrl);
    fields[ctrl.dataset.field] = num;
    setFill(range);
    range.addEventListener('input', () => { num.value = range.value; setFill(range); compute(); });
    num.addEventListener('input', () => { range.value = readNum(num); setFill(range); compute(); });
  });
  $$('input[name=sc]', form).forEach((r) => r.addEventListener('change', compute));

  let summary = '';

  function compute() {
    const v = Object.fromEntries(Object.entries(fields).map(([k, el]) => [k, readNum(el)]));
    const defectPct = Math.min(v.defect, 100);
    const sharePct = Math.min(v.share, 100);
    const sc = +$('input[name=sc]:checked', form).value;

    const month = v.units * v.days;
    const defects = (month * defectPct) / 100;
    const client = (defects * sharePct) / 100;
    const retLoss = client * (v.price + v.ret);
    const internal = (defects - client) * v.price;
    const total = retLoss + internal;
    const year = total * 12;
    const save = (year * sc) / 100;

    const returns = Math.round(client);
    const hours = Math.round(client * 1.5);
    const units = v.price > 0 ? Math.round(total / v.price) : 0;

    $('#c-month').textContent = money(total, 1e8);
    $('#c-year').textContent = money(year);
    $('#c-pct').textContent = sc + '%';
    $('#c-save').textContent = money(save);
    $('#c-returns').textContent = nf0.format(returns);
    $('#c-returns-w').textContent = plural(returns, ['возврат', 'возврата', 'возвратов']);
    $('#c-hours').textContent = nf0.format(hours);
    $('#c-hours-w').textContent = plural(hours, ['час', 'часа', 'часов']);
    $('#c-units').textContent = nf0.format(units);
    $('#c-units-w').textContent = plural(units, ['единицы', 'единиц', 'единиц']);

    const f = (n) => nf1.format(n);
    $('#c-formula').innerHTML = [
      `${f(v.units)} ед./день × ${f(v.days)} дн. = ${f(month)} ед. в месяц`,
      `${f(month)} × ${f(defectPct)}% брака = ${f(defects)} ед. брака`,
      `${f(defects)} × ${f(sharePct)}% уходит клиенту = ${f(client)} возвратов`,
      `${f(client)} × (${f(v.price)} ₽ + ${f(v.ret)} ₽) = ${f(retLoss)} ₽ — потери от возвратов`,
      `(${f(defects)} − ${f(client)}) × ${f(v.price)} ₽ = ${f(internal)} ₽ — внутренние потери`,
      `Итого ${nf0.format(total)} ₽/мес × 12 × ${sc}% = ${nf0.format(save)} ₽/год`,
    ].map((s) => `<li>${s}</li>`).join('');

    summary = `Выпуск ${f(v.units)} ед./день, ${f(v.days)} дн./мес, брак ${f(defectPct)}%, у клиента ${f(sharePct)}%, ` +
      `цена ${f(v.price)} ₽, возврат ${f(v.ret)} ₽. Потери ≈ ${nf0.format(total)} ₽/мес; потенциальная экономия (${sc}%) ≈ ${nf0.format(save)} ₽/год.`;
  }

  $('#c-cta').addEventListener('click', () => {
    $('#f-calc').value = summary;
    const note = $('#f-calc-note');
    note.textContent = `К заявке приложен ваш расчёт: потери ≈ ${$('#c-month').textContent} в месяц.`;
    note.hidden = false;
  });

  compute();
}

/* ================= До / После ================= */
function initBeforeAfter() {
  const ba = $('#ba');
  const range = $('.ba__range', ba);

  // Блистер с гайками: одна ячейка пустая
  const cells = $('#pack-cells');
  const boxes = $('#pack-boxes');
  const missing = 7;
  let cHtml = '', bHtml = '';
  for (let k = 0; k < 10; k++) {
    const x = 170 + (k % 5) * 115;
    const y = k < 5 ? 150 : 300;
    cHtml += `<circle cx="${x}" cy="${y}" r="48" fill="#c4cdd6"/><circle cx="${x}" cy="${y}" r="46" fill="url(#cell)" stroke="rgba(255,255,255,.7)"/>`;
    if (k !== missing) {
      const hex = [0, 60, 120, 180, 240, 300].map((d) => {
        const a = ((d + 15) * Math.PI) / 180;
        return `${(x + 30 * Math.cos(a)).toFixed(1)},${(y + 30 * Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      cHtml += `<polygon points="${hex}" fill="url(#nut)" stroke="#7a5a10"/><circle cx="${x}" cy="${y}" r="12" fill="#cfd8e0" stroke="#7a5a10" stroke-width="2"/>`;
      bHtml += `<rect x="${x - 40}" y="${y - 40}" width="80" height="80" fill="none" stroke="#2ee6a8" stroke-width="2" stroke-dasharray="6 4"/>`;
    } else {
      cHtml += `<circle cx="${x}" cy="${y + 4}" r="30" fill="rgba(0,0,0,.06)"/>`;
      bHtml += `<rect x="${x - 50}" y="${y - 50}" width="100" height="100" fill="rgba(255,77,79,.18)" stroke="#ff4d4f" stroke-width="3"/>` +
        `<rect x="${x - 50}" y="${y + 50}" width="216" height="30" fill="#ff4d4f"/>` +
        `<text x="${x - 40}" y="${y + 71}" class="svg-mono" font-size="16" fill="#fff">Нет детали · 99,9%</text>`;
    }
  }
  cells.innerHTML = cHtml;
  boxes.innerHTML = bHtml +
    '<rect x="110" y="18" width="236" height="30" fill="#ff4d4f"/><text x="120" y="39" class="svg-mono" font-size="16" fill="#fff">Комплектность 9/10 — брак</text>';

  // На узких экранах картинка заполняет кадр
  $$('svg', ba).forEach((s) => s.setAttribute('preserveAspectRatio', 'xMidYMid slice'));

  const update = () => ba.style.setProperty('--x', range.value + '%');
  range.addEventListener('input', update);
  update();

  $$('.tabs [role=tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.tabs [role=tab]').forEach((t) => t.setAttribute('aria-selected', t === tab));
      $$('.ba__case', ba).forEach((c) => { c.hidden = c.dataset.case !== tab.dataset.case; });
      range.value = 50;
      update();
    });
  });
}

initGame();
initCalc();
initBeforeAfter();
