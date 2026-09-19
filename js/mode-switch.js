let currentMode = 'reisevei';

function getMode() {
  return currentMode;
}

function setMode(mode) {
  if (mode === currentMode) return;
  currentMode = mode;
  document.body.dataset.mode = mode;
  document.getElementById('mode-reisevei-btn').classList.toggle('active', mode === 'reisevei');
  document.getElementById('mode-loype-btn').classList.toggle('active', mode === 'loype');
  document.getElementById('panel').classList.toggle('hidden', mode !== 'reisevei');
  document.getElementById('loype-panel')?.classList.toggle('hidden', mode !== 'loype');
  document.getElementById('info-panel').classList.add('hidden');
  if (mode === 'reisevei') {
    syncResultPanel();
  } else {
    document.getElementById('result-panel').classList.add('hidden');
  }
  setReiseveiMapVisible(mode === 'reisevei');
  setLoypeMapVisible(mode === 'loype');
  if (mode === 'loype') {
    useMyLocationForRoute();
  }
}

function initModeSwitch() {
  document.body.dataset.mode = 'reisevei';
  document.getElementById('mode-reisevei-btn').addEventListener('click', () => setMode('reisevei'));
  document.getElementById('mode-loype-btn').addEventListener('click', () => setMode('loype'));
}

function initPanelCollapse(panelId, buttonId) {
  const panel = document.getElementById(panelId);
  const btn = document.getElementById(buttonId);
  btn.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    btn.textContent = collapsed ? '▸' : '▾';
  });
}

document.addEventListener('DOMContentLoaded', initModeSwitch);
