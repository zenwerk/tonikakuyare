const browserApi = typeof browser !== 'undefined' ? browser : chrome;

const STORAGE_KEYS = { enabled: 'enabled', patterns: 'patterns' };
const DEFAULTS = { enabled: true, patterns: [] };

function storageGet(keysOrDefaults) {
  try {
    const maybe = browserApi.storage.local.get(keysOrDefaults);
    if (maybe && typeof maybe.then === 'function') return maybe;
  } catch (e) {}
  return new Promise((resolve) => browserApi.storage.local.get(keysOrDefaults, resolve));
}

function storageSet(obj) {
  try {
    const maybe = browserApi.storage.local.set(obj);
    if (maybe && typeof maybe.then === 'function') return maybe;
  } catch (e) {}
  return new Promise((resolve) => browserApi.storage.local.set(obj, resolve));
}

function wildcardToRegex(pattern) {
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length >= 2) {
    return pattern.slice(1, -1);
  }
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return '^' + escaped + '$';
}

async function getValues() {
  const items = await storageGet(DEFAULTS);
  return {
    enabled: items[STORAGE_KEYS.enabled] ?? items.enabled ?? DEFAULTS.enabled,
    patterns: items[STORAGE_KEYS.patterns] ?? items.patterns ?? DEFAULTS.patterns,
  };
}

function setStatus(msg, ok = true) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = ok ? '#2e7d32' : '#d32f2f';
  if (msg) setTimeout(() => { el.textContent = ''; }, 2000);
}

function parsePatterns(text) {
  return text.split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function patternsToText(patterns) {
  return (patterns || []).join('\n');
}

function testUrlAgainstPatterns(url, patterns) {
  try {
    for (const p of patterns) {
      const rx = new RegExp(wildcardToRegex(p));
      if (rx.test(url)) return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

async function save() {
  const enabled = document.getElementById('enabled').checked;
  const patterns = parsePatterns(document.getElementById('patterns').value);
  await storageSet({ [STORAGE_KEYS.enabled]: enabled, [STORAGE_KEYS.patterns]: patterns });
  setStatus('保存しました');
}

async function reset() {
  await storageSet(DEFAULTS);
  await init();
  setStatus('リセットしました');
}

async function init() {
  const { enabled, patterns } = await getValues();
  document.getElementById('enabled').checked = !!enabled;
  document.getElementById('patterns').value = patternsToText(patterns);
}

function setupTest() {
  const input = document.getElementById('testUrl');
  const out = document.getElementById('testResult');
  const update = async () => {
    const { patterns, enabled } = await getValues();
    const url = input.value.trim();
    if (!url) { out.textContent = ''; return; }
    const matched = enabled && testUrlAgainstPatterns(url, patterns);
    out.textContent = matched ? '→ ブロック対象です' : '→ ブロックされません';
  };
  input.addEventListener('input', update);
}

document.addEventListener('DOMContentLoaded', async () => {
  await init();
  setupTest();
  document.getElementById('saveBtn').addEventListener('click', save);
  document.getElementById('resetBtn').addEventListener('click', reset);
});
