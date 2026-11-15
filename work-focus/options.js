/* global getBrowserApi, getSettings, compilePatterns */

const browserApi = getBrowserApi();

function setStatus(msg) {
  const el = document.getElementById('status');
  el.textContent = msg;
  setTimeout(() => {
    el.textContent = '';
  }, 2000);
}

function parsePatterns(text) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function save() {
  const enabled = document.getElementById('enabled').checked;
  const patterns = parsePatterns(document.getElementById('patterns').value);
  await browserApi.storage.local.set({ enabled, patterns });
  setStatus('保存しました');
}

async function reset() {
  // キーを消せば getSettings() が既定値を返す
  await browserApi.storage.local.clear();
  await init();
  setStatus('リセットしました');
}

async function init() {
  const { enabled, patterns } = await getSettings();
  document.getElementById('enabled').checked = enabled;
  document.getElementById('patterns').value = patterns.join('\n');
}

function setupTest() {
  const input = document.getElementById('testUrl');
  const out = document.getElementById('testResult');
  input.addEventListener('input', async () => {
    const url = input.value.trim();
    if (!url) {
      out.textContent = '';
      return;
    }
    const { enabled, patterns } = await getSettings();
    const matched =
      enabled && compilePatterns(patterns).some((regex) => regex.test(url));
    out.textContent = matched ? '→ ブロック対象です' : '→ ブロックされません';
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await init();
  setupTest();
  document.getElementById('saveBtn').addEventListener('click', save);
  document.getElementById('resetBtn').addEventListener('click', reset);
});
