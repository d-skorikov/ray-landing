'use strict';

/* ================= Настройки ================= */
// Куда отправлять заявки. GitHub Pages — статический хостинг, поэтому нужен внешний обработчик
// форм, например Formspree: 'https://formspree.io/f/xxxxxxx'. Пока пусто — откроется почтовый клиент.
const FORM_ENDPOINT = '';
const CONTACT_EMAIL = 'hello@example.com';

/* ================= Утилиты ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function plural(n, forms) {
  const a = Math.abs(Math.round(n)) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

function money(n, millionsFrom = 1e6) {
  if (Math.abs(n) >= millionsFrom) return nf2.format(n / 1e6) + ' млн ₽';
  return nf0.format(Math.round(n)) + ' ₽';
}

const polar = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
};
const pt = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;


/* ================= Canvas ================= */
// Холст с логическими координатами w×h и чёткостью на Retina
function setupCanvas(canvas, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// Координаты клика в логической системе холста
function canvasPoint(canvas, e, w, h) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * w, ((e.clientY - r.top) / r.height) * h];
}

// Анимация, которая работает только пока элемент на экране; frame(dt) получает секунды
function animateWhileVisible(el, frame) {
  let raf = 0, on = false, last = 0;
  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    frame(dt);
    if (on) raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !on) { on = true; last = performance.now(); raf = requestAnimationFrame(tick); }
    else if (!entry.isIntersecting && on) { on = false; cancelAnimationFrame(raf); }
  }).observe(el);
}

function tag(ctx, x, y, text, bg, fg = '#fff', size = 12) {
  ctx.font = `700 ${size}px "JetBrains Mono", monospace`;
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y - size - 6, w, size + 6);
  ctx.fillStyle = fg;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x + 5, y - 5);
  return w;
}

/* ================= Форма заявки ================= */
function initForm() {
  const form = $('#lead-form');
  const phone = $('#f-phone');
  const msg = $('#f-msg');

  phone.addEventListener('input', () => {
    let d = phone.value.replace(/\D/g, '');
    if (!d) { phone.value = ''; return; }
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ')';
    if (d.length > 4) out += ' ' + d.slice(4, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    phone.value = out;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#f-name');
    const link = $('#f-link');
    const consent = $('input[name=consent]', form);
    const checks = [
      [name, name.value.trim().length > 1],
      [phone, phone.value.replace(/\D/g, '').length === 11],
      [link, !link.value || link.checkValidity()],
    ];
    checks.forEach(([el, ok]) => el.classList.toggle('is-invalid', !ok));
    consent.closest('.check').classList.toggle('is-invalid', !consent.checked);
    const firstBad = checks.find(([, ok]) => !ok);
    if (firstBad || !consent.checked) {
      msg.className = 'form-msg is-err';
      msg.textContent = 'Проверьте поля: имя, телефон' + (consent.checked ? '' : ' и согласие на обработку данных') + '.';
      (firstBad ? firstBad[0] : consent).focus();
      return;
    }

    const data = new FormData(form);
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    msg.className = 'form-msg';
    msg.textContent = 'Отправляем…';

    try {
      if (FORM_ENDPOINT) {
        const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(res.status);
      } else {
        const body = `Направление: ${data.get('direction') || '—'}\nИмя: ${data.get('name')}\nТелефон: ${data.get('phone')}\nСсылка: ${data.get('link') || '—'}\nРасчёт: ${data.get('calc') || '—'}`;
        window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Заявка на бесплатный тест ИИ')}&body=${encodeURIComponent(body)}`;
      }
      form.reset();
      const calcNote = $('#f-calc-note');
      if (calcNote) calcNote.hidden = true;
      msg.className = 'form-msg is-ok';
      msg.textContent = 'Спасибо! Мы свяжемся с вами в течение рабочего дня и расскажем, как прислать материалы.';
    } catch (err) {
      msg.className = 'form-msg is-err';
      msg.textContent = `Не получилось отправить. Напишите нам напрямую: ${CONTACT_EMAIL}`;
    } finally {
      btn.disabled = false;
    }
  });
}

$('#year').textContent = new Date().getFullYear();
initForm();
