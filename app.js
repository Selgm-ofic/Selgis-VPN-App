const WebApp = window.Telegram.WebApp;

WebApp.ready();
WebApp.expand();

const state = {
  connected: false,
  server: 'helsinki',
  startTime: null,
  timerInterval: null,
  upload: 0,
  download: 0,
  sessionCount: parseInt(localStorage.getItem('sessionCount') || '0'),
};

const powerBtn = document.getElementById('powerBtn');
const statusBadge = document.getElementById('statusBadge');
const timerEl = document.getElementById('timer');
const uploadStat = document.getElementById('uploadStat');
const downloadStat = document.getElementById('downloadStat');
const sessionStat = document.getElementById('sessionStat');
const serverItems = document.querySelectorAll('.server-item');

const autoStartToggle = document.getElementById('autoStart');
const killSwitchToggle = document.getElementById('killSwitch');

sessionStat.textContent = state.sessionCount;

serverItems.forEach(item => {
  item.addEventListener('click', () => {
    if (state.connected) return;
    serverItems.forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    state.server = item.dataset.server;
    WebApp.HapticFeedback.impactOccurred('light');
  });
});

powerBtn.addEventListener('click', () => {
  if (state.connected) {
    disconnect();
  } else {
    connect();
  }
  WebApp.HapticFeedback.impactOccurred('medium');
});

function connect() {
  state.connected = true;
  state.startTime = Date.now();
  state.sessionCount++;
  localStorage.setItem('sessionCount', state.sessionCount);
  sessionStat.textContent = state.sessionCount;

  powerBtn.classList.add('active');
  statusBadge.textContent = 'Подключено';
  statusBadge.classList.add('connected');
  timerEl.classList.add('active');

  simulateTraffic();
  startTimer();
}

function disconnect() {
  state.connected = false;
  state.startTime = null;

  powerBtn.classList.remove('active');
  statusBadge.textContent = 'Отключено';
  statusBadge.classList.remove('connected');
  timerEl.classList.remove('active');

  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  if (state.trafficInterval) {
    clearInterval(state.trafficInterval);
    state.trafficInterval = null;
  }
}

function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    if (!state.startTime) return;
    const diff = Math.floor((Date.now() - state.startTime) / 1000);
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    timerEl.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function simulateTraffic() {
  if (state.trafficInterval) clearInterval(state.trafficInterval);
  state.trafficInterval = setInterval(() => {
    if (!state.connected) return;
    state.upload += Math.random() * 2;
    state.download += Math.random() * 5 + 1;
    uploadStat.textContent = formatBytes(state.upload);
    downloadStat.textContent = formatBytes(state.download);
  }, 2000);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

autoStartToggle.addEventListener('change', () => {
  WebApp.HapticFeedback.selectionChanged();
});

killSwitchToggle.addEventListener('change', () => {
  WebApp.HapticFeedback.selectionChanged();
});
