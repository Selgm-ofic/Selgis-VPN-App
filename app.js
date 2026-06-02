const tg = window.Telegram?.WebApp;

// === State (in-memory, no localStorage) ===
let devices = [
  { id: 1, name: '2312FPCA6G', os: 'Android', code: '8816E6EE' },
  { id: 2, name: '23049PCD8G', os: 'Android', code: '70214852' },
  { id: 3, name: 'Infinix X6882', os: 'Android', code: '41F6E88F' }
];

let deviceLimit = 5;

let balance = 1.00;
let trafficUsed = 21.2;
let trafficLimit = Infinity; // безлимит по умолчанию
let trafficUnlimited = true;
let daysLeft = 132;
let referrals = { total: 0, active: 0, earnings: 0 };

const user = {
  name: 'SELGM',
  handle: '@Selgm_ofic',
  tgId: '123456789',
  tier: 'Базовый юзер',
  tariff: 'Текущий тариф',
  tariffEnd: '13.10.2026'
};

const TARIFES = [
  { id: 'm', name: 'Месячный', price: 250, days: 30 },
  { id: 'q', name: '3 месяца', price: 600, days: 90 },
  { id: 'h', name: '6 месяцев', price: 1100, days: 180 },
  { id: 'y', name: 'Годовой', price: 2000, days: 365 }
];

const PROMOS = { 'WELCOME100': 100, 'SELGIS2026': 250, 'BONUS50': 50 };

let tickets = [
  { id: 1, title: 'Вопрос по расширению', date: '02.06.2026', status: 'open' },
  { id: 2, title: 'Возможные причины блокировок', date: '14.04.2026', status: 'closed' }
];

let nextDeviceId = 4;
let nextTicketId = 3;

// === Init ===
function init() {
  if (tg) {
    tg.expand();
    tg.ready();
    tg.enableClosingConfirmation();
  }
  setupRefLinks();
  render();
  setupNav();
  setupActions();
  setupModals();
}

function haptic(type = 'light') {
  tg?.HapticFeedback?.impactOccurred(type);
}

function notify(type) {
  tg?.HapticFeedback?.notificationOccurred(type);
}

// === Rendering ===
function render() {
  document.getElementById('userName').textContent = user.name;
  document.getElementById('tariffEnd').textContent = user.tariffEnd;
  document.getElementById('daysLeft').textContent = daysLeft;
  document.getElementById('deviceCount').textContent = devices.length;
  document.getElementById('deviceLimit').textContent = deviceLimit;
  document.getElementById('limitInfo').textContent = deviceLimit;
  document.getElementById('balanceAmount').textContent = balance.toFixed(2);
  document.getElementById('balanceAmount2').textContent = balance.toFixed(2);
  document.getElementById('refCount').textContent = referrals.total;
  document.getElementById('refEarnings').textContent = '+' + referrals.earnings.toFixed(2) + ' ₽';
  document.getElementById('refTotal').textContent = referrals.total;
  document.getElementById('refActive').textContent = referrals.active;
  document.getElementById('refSum').textContent = referrals.earnings.toFixed(2);

  // Side menu profile
  document.getElementById('sideName').textContent = user.name;
  document.getElementById('sideHandle').textContent = user.handle;
  document.getElementById('profileName').textContent = user.name;
  document.getElementById('profileHandle').textContent = user.handle;
  document.getElementById('profileTariff').textContent = user.tariff;
  document.getElementById('profileEnd').textContent = user.tariffEnd;
  document.getElementById('profileDays').textContent = daysLeft + ' дн.';
  document.getElementById('profileTgId').textContent = user.tgId;

  // Traffic
  renderTraffic();

  // Device limit bar
  const fill = document.getElementById('deviceLimitFill');
  if (fill) {
    const pct = Math.min(100, (devices.length / deviceLimit) * 100);
    fill.style.width = pct + '%';
  }

  renderDevices();
  renderTickets();
}

function renderTraffic() {
  const fill = document.getElementById('trafficFill');
  const usedEl = document.getElementById('trafficUsed');
  const remEl = document.getElementById('trafficRemaining');

  usedEl.textContent = trafficUsed.toFixed(1);

  if (trafficUnlimited) {
    fill.style.width = Math.min(100, trafficUsed) + '%';
    remEl.innerHTML = '∞ осталось';
  } else {
    const pct = Math.min(100, (trafficUsed / trafficLimit) * 100);
    fill.style.width = pct + '%';
    const rem = Math.max(0, trafficLimit - trafficUsed);
    remEl.textContent = rem.toFixed(1) + ' GB осталось';
  }
}

function renderDevices() {
  const list = document.getElementById('devicesList');
  if (devices.length === 0) {
    list.innerHTML = '<div class="empty-text" style="padding:20px 0;text-align:center">Устройства не подключены</div>';
    return;
  }
  list.innerHTML = devices.map(d => `
    <div class="device-row" data-id="${d.id}">
      <div class="device-icon-small">
        <svg viewBox="0 0 24 24"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.18-.37.54-.22.83L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52z" fill="currentColor"/></svg>
      </div>
      <div class="device-row-info">
        <p class="device-name">${d.name}</p>
        <p class="device-meta">${d.os} · ${d.code}</p>
      </div>
      <button class="device-delete" data-del="${d.id}" aria-label="Удалить">
        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeDevice(+btn.dataset.del);
    });
  });
}

function removeDevice(id) {
  const row = document.querySelector(`.device-row[data-id="${id}"]`);
  if (row) row.classList.add('removing');
  setTimeout(() => {
    devices = devices.filter(d => d.id !== id);
    showToast('Устройство отключено', 'success');
    render();
  }, 280);
}

function renderTickets() {
  const list = document.getElementById('ticketsList');
  list.innerHTML = tickets.map(t => `
    <div class="ticket" data-ticket="${t.id}">
      <div class="ticket-info">
        <p class="ticket-title">${t.title}</p>
        <p class="ticket-date">${t.date}</p>
      </div>
      <span class="ticket-status ${t.status === 'open' ? 'status-open' : 'status-closed'}">
        ${t.status === 'open' ? 'Открыт' : 'Закрыт'}
      </span>
    </div>
  `).join('');

  list.querySelectorAll('[data-ticket]').forEach(el => {
    el.addEventListener('click', () => openTicket(+el.dataset.ticket));
  });
}

// === Navigation ===
function setupNav() {
  document.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      goTo(el.dataset.go);
      // Close side menu if open
      document.getElementById('sideMenu')?.classList.remove('active');
    });
  });
}

function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.go === page));
  haptic();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// === Actions ===
function setupActions() {
  document.getElementById('activatePromo').addEventListener('click', activatePromo);
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sideMenu').classList.add('active');
  });
  document.getElementById('sideMenuClose').addEventListener('click', () => {
    document.getElementById('sideMenu').classList.remove('active');
  });
  document.getElementById('sideMenu').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });
  document.getElementById('notifBtn').addEventListener('click', () => {
    showToast('Доступно обновление v1.1', 'success');
  });

  document.querySelectorAll('.pay-card').forEach(btn => {
    btn.addEventListener('click', () => openPayment(btn.dataset.pay));
  });

  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.copy);
      copyText(input.value);
    });
  });

  document.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      handleAction(el.dataset.action);
    });
  });
}

function setupModals() {
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modalClose').addEventListener('click', closeModal);
}

// === Logic ===
function activatePromo() {
  const input = document.getElementById('promoInput');
  const code = input.value.trim().toUpperCase();
  if (!code) {
    showToast('Введите промокод', 'error');
    return;
  }
  const bonus = PROMOS[code];
  if (bonus) {
    balance += bonus;
    input.value = '';
    showToast('+' + bonus + ' ₽ на баланс', 'success');
    notify('success');
    render();
  } else {
    showToast('Промокод не найден', 'error');
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Скопировано', 'success');
    haptic();
  });
}

function openPayment(method) {
  const limits = { wata: [10, 100000], platega: [10, 1000000], stars: [1, 10000] };
  const [min, max] = limits[method];
  openModal({
    title: 'Пополнение через ' + method.toUpperCase(),
    body: `
      <div class="field">
        <label class="field-label">Сумма (₽)</label>
        <input type="number" class="field-input" id="payAmount" min="${min}" max="${max}" value="${min * 10}">
      </div>
      <div class="amount-presets" id="payPresets">
        ${[100, 250, 500, 1000, 2000, 5000].filter(v => v >= min && v <= max).map(v => `<button class="preset" data-amt="${v}">${v}</button>`).join('')}
      </div>
    `,
    footer: `
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" id="confirmPay">Оплатить</button>
    `,
    onOpen: () => {
      const presets = document.querySelectorAll('#payPresets .preset');
      presets.forEach(p => p.onclick = () => {
        presets.forEach(x => x.classList.remove('selected'));
        p.classList.add('selected');
        document.getElementById('payAmount').value = p.dataset.amt;
      });
      document.getElementById('confirmPay').onclick = () => {
        const amount = +document.getElementById('payAmount').value;
        if (!amount || amount < min || amount > max) {
          showToast('Некорректная сумма', 'error');
          return;
        }
        balance += amount;
        closeModal();
        showToast('Баланс +' + amount + ' ₽', 'success');
        notify('success');
        render();
      };
    }
  });
}

function openTicket(id) {
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  openModal({
    title: t.title,
    body: `
      <p class="muted-small" style="margin-bottom:14px">${t.date}</p>
      <p style="font-size:14px;line-height:1.5;color:var(--muted)">
        ${t.status === 'open' ? 'Это активный тикет. Мы ответим в ближайшее время.' : 'Этот тикет закрыт.'}
      </p>
    `,
    footer: t.status === 'open'
      ? `<button class="btn-secondary" id="closeTicket">Закрыть</button><button class="btn-primary" onclick="closeModal()">ОК</button>`
      : `<button class="btn-primary" onclick="closeModal()">Закрыть</button>`,
    onOpen: () => {
      const btn = document.getElementById('closeTicket');
      if (btn) btn.onclick = () => {
        t.status = 'closed';
        closeModal();
        showToast('Тикет закрыт', 'success');
        render();
      };
    }
  });
}

function handleAction(action) {
  const handlers = {
    'add-devices': () => {
      let newLimit = deviceLimit;
      openModal({
        title: 'Лимит устройств',
        body: `
          <p class="muted-small" style="margin-bottom:14px">Текущий лимит: ${deviceLimit} · Стоимость: 50 ₽/мес за каждое устройство.</p>
          <div class="field">
            <label class="field-label">Всего устройств</label>
            <div class="counter">
              <button id="dec">−</button>
              <span class="counter-value" id="cnt">${newLimit}</span>
              <button id="inc">+</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid rgba(255,255,255,0.05)">
            <span class="muted">К оплате:</span>
            <span class="big-value" style="margin:0;font-size:18px" id="total">0 ₽/мес</span>
          </div>
        `,
        footer: `<button class="btn-secondary" onclick="closeModal()">Отмена</button><button class="btn-primary" id="confirm">Сохранить</button>`,
        onOpen: () => {
          const cnt = document.getElementById('cnt');
          const total = document.getElementById('total');
          const update = () => {
            const extra = Math.max(0, newLimit - 5);
            cnt.textContent = newLimit;
            total.textContent = (extra * 50) + ' ₽/мес';
          };
          update();
          document.getElementById('inc').onclick = () => { newLimit++; update(); };
          document.getElementById('dec').onclick = () => { if (newLimit > 1) { newLimit--; update(); } };
          document.getElementById('confirm').onclick = () => {
            const extra = Math.max(0, newLimit - 5);
            const cost = extra * 50;
            if (balance < cost) { showToast('Недостаточно средств', 'error'); return; }
            balance -= cost;
            deviceLimit = newLimit;
            closeModal();
            showToast('Лимит: ' + deviceLimit + ' устройств', 'success');
            notify('success');
            render();
          };
        }
      });
    },
    'info': () => {
      goTo('info');
      document.getElementById('sideMenu').classList.remove('active');
    },
    'logout': () => {
      openModal({
        title: 'Выйти из аккаунта?',
        body: `<p class="muted">Вы сможете войти снова через Telegram.</p>`,
        footer: `<button class="btn-secondary" onclick="closeModal()">Отмена</button><button class="btn-primary" id="confirmLogout">Выйти</button>`,
        onOpen: () => {
          document.getElementById('confirmLogout').onclick = () => {
            if (tg) tg.close();
            else showToast('Демо: выход недоступен', 'success');
          };
        }
      });
    },
    'servers': () => {
      openModal({
        title: 'Серверы',
        body: `
          <div class="tariff-options">
            <div class="tariff-option selected">
              <div class="tariff-option-radio"></div>
              <div class="tariff-option-info">
                <div class="tariff-option-name">🇫🇮 Финляндия</div>
                <div class="tariff-option-desc">Хельсинки · 15 ms</div>
              </div>
            </div>
            <div class="tariff-option">
              <div class="tariff-option-radio"></div>
              <div class="tariff-option-info">
                <div class="tariff-option-name">🇳🇱 Нидерланды</div>
                <div class="tariff-option-desc">Амстердам · 32 ms</div>
              </div>
            </div>
            <div class="tariff-option">
              <div class="tariff-option-radio"></div>
              <div class="tariff-option-info">
                <div class="tariff-option-name">🇩🇪 Германия</div>
                <div class="tariff-option-desc">Франкфурт · 28 ms</div>
              </div>
            </div>
          </div>
        `,
        footer: `<button class="btn-primary" onclick="closeModal()">Готово</button>`
      });
    },
    'change-tariff': () => {
      openModal({
        title: 'Сменить тариф',
        body: `
          <div class="tariff-options" id="tarOpts">
            ${TARIFES.map(t => `
              <div class="tariff-option" data-id="${t.id}">
                <div class="tariff-option-radio"></div>
                <div class="tariff-option-info">
                  <div class="tariff-option-name">${t.name}</div>
                  <div class="tariff-option-desc">${t.days} дней</div>
                </div>
                <div class="tariff-option-price">${t.price} ₽</div>
              </div>
            `).join('')}
          </div>
        `,
        footer: `<button class="btn-secondary" onclick="closeModal()">Отмена</button><button class="btn-primary" id="confirmTar">Применить</button>`,
        onOpen: () => {
          const opts = document.querySelectorAll('#tarOpts .tariff-option');
          opts.forEach(o => o.onclick = () => {
            opts.forEach(x => x.classList.remove('selected'));
            o.classList.add('selected');
          });
          document.getElementById('confirmTar').onclick = () => {
            const sel = document.querySelector('#tarOpts .tariff-option.selected');
            if (!sel) { showToast('Выберите тариф', 'error'); return; }
            const t = TARIFES.find(x => x.id === sel.dataset.id);
            if (balance < t.price) { showToast('Недостаточно средств', 'error'); return; }
            balance -= t.price;
            daysLeft = t.days;
            closeModal();
            showToast('Тариф "' + t.name + '" активирован', 'success');
            notify('success');
            render();
          };
        }
      });
    },
    'delete-all': () => {
      openModal({
        title: 'Удалить все устройства?',
        body: `<p class="muted">Все устройства будут отключены от VPN.</p>`,
        footer: `<button class="btn-secondary" onclick="closeModal()">Отмена</button><button class="btn-primary" id="confirmDel">Удалить</button>`,
        onOpen: () => {
          document.getElementById('confirmDel').onclick = () => {
            devices = [];
            closeModal();
            showToast('Устройства удалены', 'success');
            render();
          };
        }
      });
    },
    'new-ticket': () => {
      openModal({
        title: 'Новый тикет',
        body: `
          <div class="field">
            <label class="field-label">Тема</label>
            <input type="text" class="field-input" id="tTitle" placeholder="Кратко опишите проблему">
          </div>
          <div class="field">
            <label class="field-label">Сообщение</label>
            <textarea class="field-textarea" id="tText" placeholder="Подробности..."></textarea>
          </div>
        `,
        footer: `<button class="btn-secondary" onclick="closeModal()">Отмена</button><button class="btn-primary" id="createT">Создать</button>`,
        onOpen: () => {
          document.getElementById('createT').onclick = () => {
            const title = document.getElementById('tTitle').value.trim();
            const text = document.getElementById('tText').value.trim();
            if (!title || !text) { showToast('Заполните все поля', 'error'); return; }
            tickets.unshift({ id: nextTicketId++, title, date: new Date().toLocaleDateString('ru-RU'), status: 'open' });
            closeModal();
            showToast('Тикет создан', 'success');
            render();
          };
        }
      });
    },
    'instructions': () => {
      openModal({
        title: 'Инструкции',
        body: `
          <div style="line-height:1.6;font-size:14px;display:flex;flex-direction:column;gap:14px">
            <div><b>📱 Android:</b><br>v2rayNG / Hiddify → Подписки → Вставить ссылку</div>
            <div><b>🍎 iOS:</b><br>Streisand / V2Box → Добавить подписку</div>
            <div><b>💻 Windows:</b><br>v2rayN / Nekoray → Импорт конфига</div>
            <div><b>🍏 macOS:</b><br>Sing-box / Streisand → Импорт подписки</div>
          </div>
        `,
        footer: `<button class="btn-primary" onclick="closeModal()">Понятно</button>`
      });
    },
    'about': () => {
      openModal({
        title: 'О сервисе',
        body: `
          <div style="text-align:center;padding:20px 0">
            <div class="header-logo" style="width:64px;height:64px;margin:0 auto 16px"></div>
            <h3 style="margin-bottom:8px">Selgis VPN</h3>
            <p class="muted-small">v1.0.0</p>
            <p style="font-size:13px;line-height:1.6;color:var(--muted);margin-top:16px">
              VLESS + Reality<br>
              Финляндия · Нидерланды · Германия
            </p>
          </div>
        `,
        footer: `<button class="btn-primary" onclick="closeModal()">Закрыть</button>`
      });
    }
  };
  handlers[action]?.();
}

// === Ref links ===
function setupRefLinks() {
  document.getElementById('refBotLink').value = 'https://t.me/SelgisVPNbot?start=refABC';
  document.getElementById('refCabLink').value = 'https://selgisvpn.top/login?ref=ABC';
}

// === Modal ===
function openModal({ title, body, footer, onOpen }) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalFooter').innerHTML = footer || '';
  document.getElementById('modalOverlay').classList.add('active');
  onOpen?.();
  haptic();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// === Toast ===
function showToast(text, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.className = 'toast show ' + type;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.className = 'toast'; }, 2500);
}

document.addEventListener('DOMContentLoaded', init);
