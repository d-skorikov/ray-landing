'use strict';

/* ================= Подбор по задаче ================= */
function initPicker() {
  const opts = $$('.picker__opt');
  const res = $('#picker-res');

  function select(btn) {
    opts.forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
    const card = $('#' + btn.dataset.target);
    res.href = '#' + card.id;
    $('#picker-name').textContent = card.dataset.name;
    $('#picker-tops').textContent = card.dataset.tops;
    const tops = parseInt(card.dataset.tops, 10);
    $('#picker-unit').textContent = `${tops} TOPS = ${tops} трлн операций нейросети в секунду`;
    $('#picker-price').textContent = card.dataset.price;
    res.classList.remove('is-flash');
    void res.offsetWidth; // перезапуск анимации
    res.classList.add('is-flash');
  }

  opts.forEach((btn, i) => {
    btn.addEventListener('click', () => select(btn));
    // Стрелки переключают варианты, как в обычной группе радиокнопок
    btn.addEventListener('keydown', (e) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = opts[(i + step + opts.length) % opts.length];
      next.focus();
      select(next);
    });
  });

  // Переход к карточке подсвечивает её
  res.addEventListener('click', () => {
    const card = $(res.getAttribute('href'));
    card.classList.remove('is-target');
    void card.offsetWidth;
    card.classList.add('is-target');
  });
}

/* ================= «Обсудить задачу» прикладывает вычислитель к заявке ================= */
function initDeviceCta() {
  const calc = $('#f-calc');
  const note = $('#f-calc-note');
  $$('[data-device]').forEach((a) => {
    a.addEventListener('click', () => {
      calc.value = `Интересует: ${a.dataset.device}`;
      note.textContent = `К заявке приложено: ${a.dataset.device}`;
      note.hidden = false;
    });
  });
}

initPicker();
initDeviceCta();
