const tg = window.Telegram?.WebApp;
const API_BASE = 'http://127.0.0.1:8000';
let API_TOKEN = '';

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (API_TOKEN) opts.headers['Authorization'] = `Bearer ${API_TOKEN}`;
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(API_BASE + path, opts);
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: r.statusText })); throw new Error(e.detail || 'API error'); }
  return r.json();
}

async function login() {
  if (tg?.initData) {
    const res = await api('POST', '/api/auth/login', { init_data: tg.initData });
    API_TOKEN = res.token;
    return;
  }
  // Fallback for local dev without Telegram
  const tgId = prompt('Telegram ID (dev):') || 'dev_' + Date.now();
  const res = await api('POST', '/api/auth/login', { init_data: `id=${tgId}&first_name=Dev&username=dev_user` });
  API_TOKEN = res.token;
}

async function loadData() {
  try {
    const [profile, devs, ticketsData, refInfo, balanceData, notifCount] = await Promise.all([
      api('GET', '/api/user/profile'),
      api('GET', '/api/devices'),
      api('GET', '/api/tickets'),
      api('GET', '/api/referrals'),
      api('GET', '/api/payments/balance'),
      api('GET', '/api/notifications/unread-count'),
    ]);
    user.name = profile.name;
    user.handle = profile.handle;
    user.tgId = profile.tg_id;
    user.googleEmail = profile.google_email;
    user.tier = profile.tier;
    user.tariff = profile.tariff;
    user.tariffEnd = profile.tariff_end || '';
    daysLeft = profile.days_left;
    balance = profile.balance;
    deviceLimit = profile.device_limit;
    devices = devs;
    tickets = ticketsData.map(t => ({
      id: t.id,
      title: t.subject,
      date: new Date(t.created_at).toLocaleDateString(),
      status: t.status,
      messages: []
    }));
    referrals = {
      total: refInfo.total,
      active: refInfo.active,
      earnings: refInfo.earnings,
      list: (refInfo.referrals || []).map(r => ({
        name: r.handle.replace('@', ''),
        date: new Date(r.created_at).toLocaleDateString(),
        paid: r.status === 'paid',
        amount: 0
      })),
      history: (refInfo.history || []).map(h => ({
        action: h.description,
        name: '',
        amount: h.amount,
        date: new Date(h.created_at).toLocaleDateString()
      }))
    };
    if (notifCount.count > 0) {
      document.getElementById('notifBadge').textContent = notifCount.count;
      document.getElementById('notifBadge').style.display = '';
    }
    document.getElementById('notifBadge').style.display = notifCount.count > 0 ? '' : 'none';
  } catch (e) {
    console.error('loadData error:', e);
  }
  render();
}

// === State ===
let devices = [];
let deviceLimit = 5;
let balance = 0;
let trafficUsed = 0;
let trafficLimit = Infinity;
let trafficUnlimited = true;
let daysLeft = 0;
let referrals = {
  total: 0,
  active: 0,
  earnings: 0,
  list: [],
  history: []
};

const user = {
  name: '',
  handle: '',
  tgId: '',
  googleEmail: null,
  tier: '',
  tariff: '',
  tariffEnd: ''
};

const TARIFES = [
  { id: 'm', name: 'Месячный', price: 250, days: 30 },
  { id: 'q', name: '3 месяца', price: 600, days: 90 },
  { id: 'h', name: '6 месяцев', price: 1100, days: 180 },
  { id: 'y', name: 'Годовой', price: 2000, days: 365 }
];

const PROMOS = { 'WELCOME100': 100, 'SELGIS2026': 250, 'BONUS50': 50 };

let tickets = [];
let nextDeviceId = 1;
let nextTicketId = 1;

// === Init ===
async function init() {
  if (tg) {
    tg.expand();
    tg.ready();
    tg.enableClosingConfirmation();
  }
  try {
    await login();
    await loadData();
  } catch (e) {
    console.error('Auth error:', e);
    render();
  }
  setupRefLinks();
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
  const profileGoogle = document.getElementById('profileGoogle');
  if (profileGoogle) {
    profileGoogle.textContent = user.googleEmail || 'Привязать';
    profileGoogle.style.color = user.googleEmail ? 'var(--gold)' : 'var(--muted)';
  }

  // Traffic
  renderTraffic();

  // Device limit bar
  const fill = document.getElementById('deviceLimitFill');
  if (fill) {
    const pct = Math.min(100, (devices.length / deviceLimit) * 100);
    fill.style.width = pct + '%';
  }

  renderReferrals();
  renderDevices();
  renderTickets();
}

function renderTraffic() {
  const fill = document.getElementById('trafficFill');
  const usedEl = document.getElementById('trafficUsed');
  const remEl = document.getElementById('trafficRemaining');

  usedEl.textContent = trafficUsed.toFixed(1);

  if (trafficUnlimited) {
    fill.style.width = '100%';
    remEl.innerHTML = '∞ осталось';
  } else {
    const pct = Math.min(100, (trafficUsed / trafficLimit) * 100);
    fill.style.width = pct + '%';
    const rem = Math.max(0, trafficLimit - trafficUsed);
    remEl.textContent = rem.toFixed(1) + ' GB осталось';
  }
}

function renderReferrals() {
  // Referral list tab
  const listContainer = document.getElementById('refListContainer');
  if (listContainer) {
    if (referrals.list.length === 0) {
      listContainer.innerHTML = '<div class="empty-text" style="padding:12px 0;text-align:center">Пока нет рефералов</div>';
    } else {
      listContainer.innerHTML = referrals.list.map(r => `
        <div class="ref-item">
          <div class="ref-avatar"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/></svg></div>
          <div class="ref-item-info">
            <p class="ref-item-name">@${r.name}</p>
            <p class="ref-item-date">${r.date}</p>
          </div>
          <span class="ref-item-status ${r.paid ? 'status-paid' : 'status-pending'}">
            ${r.paid ? 'Оплатил' : 'Ожидание'}
          </span>
        </div>
      `).join('');
    }
  }

  // History tab
  const historyContainer = document.getElementById('refHistoryContainer');
  if (historyContainer) {
    if (referrals.history.length === 0) {
      historyContainer.innerHTML = '<div class="empty-text" style="padding:12px 0;text-align:center">История пуста</div>';
    } else {
      historyContainer.innerHTML = referrals.history.map(h => `
        <div class="history-item">
          <div class="history-icon"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg></div>
          <div class="history-info">
            <p class="history-title">${h.action} — @${h.name}</p>
            <p class="history-date">${h.date}</p>
          </div>
          <span class="history-amount">+${h.amount.toFixed(2)} ₽</span>
        </div>
      `).join('');
    }
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

async function removeDevice(id) {
  const row = document.querySelector(`.device-row[data-id="${id}"]`);
  if (row) row.classList.add('removing');
  try {
    await api('DELETE', `/api/devices/${id}`);
    devices = devices.filter(d => d.id !== id);
    showToast('Устройство отключено', 'success');
    render();
  } catch (e) {
    if (row) row.classList.remove('removing');
    showToast(e.message, 'error');
  }
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
  document.getElementById('notifBtn').addEventListener('click', async () => {
    let notifs = [];
    try {
      const data = await api('GET', '/api/notifications');
      notifs = data.map(n => ({
        title: n.title,
        desc: n.body,
        time: new Date(n.created_at).toLocaleDateString(),
        read: n.is_read
      }));
    } catch (e) { showToast(e.message, 'error'); }
    if (notifs.length === 0) {
      notifs = [{ title: 'Нет уведомлений', desc: 'Всё тихо', time: '', read: true }];
    }
    openModal({
      title: 'Уведомления',
      body: `
        <div style="display:flex;flex-direction:column;gap:6px">
          ${notifs.map(n => `
            <div class="notif-item ${!n.read ? 'notif-unread' : ''}">
              <p class="notif-title">${n.title}</p>
              <p class="notif-desc">${n.desc}</p>
              <p class="notif-time">${n.time}</p>
            </div>
          `).join('')}
        </div>
      `,
      footer: `<button class="btn-primary" id="readAll">Прочесть все</button>`,
      onOpen: () => {
        document.getElementById('readAll').onclick = async () => {
          try { await api('POST', '/api/notifications/read-all'); } catch (e) { showToast(e.message, 'error'); }
          const badge = document.querySelector('.badge');
          if (badge) badge.style.display = 'none';
          closeModal();
          showToast('Все уведомления прочитаны', 'success');
        };
      }
    });
    haptic();
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

  // Referral tabs
  document.querySelectorAll('[data-reftab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-reftab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const list = document.getElementById('refListContainer');
      const hist = document.getElementById('refHistoryContainer');
      if (list) list.style.display = 'none';
      if (hist) hist.style.display = 'none';
      const tab = btn.dataset.reftab;
      const target = document.getElementById('ref' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Container');
      if (target) target.style.display = '';
    });
  });

  const withdrawBtn = document.getElementById('withdrawRef');
  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', async () => {
      try {
        const res = await api('POST', '/api/referrals/withdraw');
        balance = res.balance;
        referrals.earnings = 0;
        showToast('Средства зачислены на баланс', 'success');
        render();
      } catch (e) { showToast(e.message, 'error'); }
    });
  }

  const profileGoogle = document.getElementById('profileGoogle');
  if (profileGoogle) {
    profileGoogle.addEventListener('click', async () => {
      if (user.googleEmail) {
        try {
          await api('PUT', '/api/user/profile', { google_email: '' });
          user.googleEmail = null;
          showToast('Google аккаунт отвязан', 'success');
        } catch (e) { showToast(e.message, 'error'); }
      } else {
        const email = prompt('Введите email Google:');
        if (!email) return;
        try {
          await api('PUT', '/api/user/profile', { google_email: email });
          user.googleEmail = email;
          showToast('Google аккаунт привязан', 'success');
        } catch (e) { showToast(e.message, 'error'); }
      }
      render();
    });
  }
}

function setupModals() {
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modalClose').addEventListener('click', closeModal);
}

// === Logic ===
async function activatePromo() {
  const input = document.getElementById('promoInput');
  const code = input.value.trim().toUpperCase();
  if (!code) { showToast('Введите промокод', 'error'); return; }
  try {
    const res = await api('POST', '/api/payments/promo', { code });
    balance = res.balance;
    input.value = '';
    showToast('+' + res.bonus + ' ₽ на баланс', 'success');
    notify('success');
    render();
  } catch (e) { showToast(e.message, 'error'); }
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
      document.getElementById('confirmPay').onclick = async () => {
        const amount = +document.getElementById('payAmount').value;
        if (!amount || amount < min || amount > max) {
          showToast('Некорректная сумма', 'error');
          return;
        }
        try {
          const res = await api('POST', '/api/payments/topup', { method, amount });
          balance = res.balance;
          closeModal();
          showToast('Баланс +' + amount + ' ₽', 'success');
          notify('success');
          render();
        } catch (e) { showToast(e.message, 'error'); }
      };
    }
  });
        render();
      };
    }
  });
}

async function openTicket(id) {
  try {
    let msgs = [];
    let t = tickets.find(x => x.id === id);
    let subject = t ? t.title : 'Тикет #' + id;
    let status = t ? t.status : 'open';

    const detail = await api('GET', `/api/tickets/${id}`);
    subject = detail.subject;
    status = detail.status;
    msgs = (detail.messages || []).map(m => ({
      from: m.sender === 'user' ? 'user' : 'support',
      text: m.text,
      time: new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }));

    openModal({
      title: subject,
      body: `
        <div class="chat-container" id="chatContainer">
          ${msgs.map(m => `
            <div class="chat-msg ${m.from === 'user' ? 'chat-user' : 'chat-support'}">
              <div class="chat-bubble">${m.text}</div>
              <span class="chat-time">${m.time || ''}</span>
            </div>
          `).join('')}
        </div>
        ${status === 'open' ? `
          <div class="chat-input-row">
            <input type="text" class="chat-input" id="chatInput" placeholder="Написать сообщение..." maxlength="500">
            <button class="chat-send" id="chatSend">
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/></svg>
            </button>
          </div>
        ` : '<p class="muted-small" style="text-align:center;padding:12px">Тикет закрыт</p>'}
      `,
      footer: status === 'open'
        ? `<button class="btn-secondary" id="closeTicket">Закрыть тикет</button><button class="btn-primary" onclick="closeModal()">Закрыть</button>`
        : `<button class="btn-primary" onclick="closeModal()">Закрыть</button>`,
      onOpen: () => {
        const container = document.getElementById('chatContainer');
        if (container) container.scrollTop = container.scrollHeight;

        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('chatSend');
        if (input && sendBtn) {
          async function send() {
            const text = input.value.trim();
            if (!text) return;
            try {
              await api('POST', `/api/tickets/${id}/messages`, { text });
              input.value = '';
              openTicket(id);
            } catch (e) { showToast(e.message, 'error'); }
          }
          sendBtn.onclick = send;
          input.onkeydown = e => { if (e.key === 'Enter') send(); };
        }

        const btn = document.getElementById('closeTicket');
        if (btn) btn.onclick = async () => {
          try { await api('PUT', `/api/tickets/${id}/close`); } catch (e) { showToast(e.message, 'error'); }
          closeModal();
          showToast('Тикет закрыт', 'success');
          render();
        };
      }
    });
  } catch (e) { showToast(e.message, 'error'); }
}

function renderTicketChat(t) {
  const container = document.getElementById('chatContainer');
  if (!container) return;
  const msgs = t.messages || [];
  container.innerHTML = msgs.map(m => `
    <div class="chat-msg ${m.from === 'user' ? 'chat-user' : 'chat-support'}">
      <div class="chat-bubble">${m.text}</div>
      <span class="chat-time">${m.time || ''}</span>
    </div>
  `).join('');
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
          document.getElementById('confirmTar').onclick = async () => {
            const sel = document.querySelector('#tarOpts .tariff-option.selected');
            if (!sel) { showToast('Выберите тариф', 'error'); return; }
            const t = TARIFES.find(x => x.id === sel.dataset.id);
            try {
              const res = await api('POST', '/api/subscription/purchase', { tariff_id: t.id });
              balance = res.balance;
              await loadData();
              closeModal();
              showToast('Тариф "' + t.name + '" активирован', 'success');
              notify('success');
            } catch (e) { showToast(e.message, 'error'); }
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
          document.getElementById('confirmDel').onclick = async () => {
            try { await api('DELETE', '/api/devices'); } catch (e) { showToast(e.message, 'error'); }
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
          document.getElementById('createT').onclick = async () => {
            const title = document.getElementById('tTitle').value.trim();
            const text = document.getElementById('tText').value.trim();
            if (!title || !text) { showToast('Заполните все поля', 'error'); return; }
            try {
              const res = await api('POST', '/api/tickets', { subject: title, message: text });
              await loadData();
              closeModal();
              showToast('Тикет создан', 'success');
            } catch (e) { showToast(e.message, 'error'); }
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
