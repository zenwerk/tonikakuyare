/* global getBrowserApi, getSettings, getStats, normalizePattern, compilePatterns, isBlockedUrl */

const browserApi = getBrowserApi();

// 保存済みのパターン（表示中のリストと同じ並び）と、編集中の行の位置（-1 は編集なし）
let patterns = [];
let editingIndex = -1;
let statusTimer;

function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    el.textContent = '';
  }, 2000);
}

function createElement(tag, className, text = '') {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

function createButton(label, onClick) {
  const button = createElement('button', '', label);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

// 問題があればエラーメッセージを返す（index は編集中の行。自分自身との重複は除く）
function validatePattern(pattern, index = -1) {
  if (!pattern) return 'ドメインを入力してください';
  if (compilePatterns([pattern]).length === 0) {
    return '正規表現が正しくありません';
  }
  if (patterns.some((p, i) => i !== index && p === pattern)) {
    return '既に登録されています';
  }
  return '';
}

async function savePatterns(next, message) {
  await browserApi.storage.local.set({ patterns: next });
  patterns = next;
  editingIndex = -1;
  renderPatterns();
  updateTestResult();
  setStatus(message);
}

async function addPattern(event) {
  event.preventDefault();
  const input = document.getElementById('newPattern');
  const pattern = normalizePattern(input.value);
  const error = validatePattern(pattern);
  if (error) {
    setStatus(error, true);
    return;
  }
  await savePatterns([...patterns, pattern], `${pattern} を追加しました`);
  input.value = '';
}

async function updatePattern(index, value) {
  const pattern = normalizePattern(value);
  const error = validatePattern(pattern, index);
  if (error) {
    setStatus(error, true);
    return;
  }
  const next = patterns.map((p, i) => (i === index ? pattern : p));
  await savePatterns(next, `${pattern} に変更しました`);
}

async function deletePattern(index) {
  const next = patterns.filter((_, i) => i !== index);
  await savePatterns(next, `${patterns[index]} を削除しました`);
}

function startEditing(index) {
  editingIndex = index;
  renderPatterns();
  const input = document.querySelector('#patternList input');
  input.focus();
  input.select();
}

function cancelEditing() {
  editingIndex = -1;
  renderPatterns();
}

function renderEditingRow(item, pattern, index) {
  const input = createElement('input', '');
  input.type = 'text';
  input.value = pattern;
  input.addEventListener('keydown', (event) => {
    // 日本語入力の変換確定の Enter では保存しない
    if (event.isComposing) return;
    if (event.key === 'Enter') updatePattern(index, input.value);
    if (event.key === 'Escape') cancelEditing();
  });
  item.append(
    input,
    createButton('保存', () => updatePattern(index, input.value)),
    createButton('キャンセル', cancelEditing)
  );
}

function renderPatterns() {
  const list = document.getElementById('patternList');
  if (patterns.length === 0) {
    list.replaceChildren(
      createElement('li', 'pattern-empty', 'まだ登録されていません')
    );
    return;
  }
  list.replaceChildren(
    ...patterns.map((pattern, index) => {
      const item = document.createElement('li');
      if (index === editingIndex) {
        renderEditingRow(item, pattern, index);
      } else {
        item.append(
          createElement('span', 'pattern-text', pattern),
          createButton('編集', () => startEditing(index)),
          createButton('削除', () => deletePattern(index))
        );
      }
      return item;
    })
  );
}

async function setEnabled(event) {
  const enabled = event.target.checked;
  await browserApi.storage.local.set({ enabled });
  setStatus(enabled ? '有効にしました' : '無効にしました');
  updateTestResult();
}

async function reset() {
  if (
    !confirm(
      '設定を初期状態に戻しますか？登録したドメインは初期値（x.com, posfile.com, togetter.com）に戻ります。'
    )
  ) {
    return;
  }
  // キーを消せば getSettings() が既定値を返す（統計は残す）
  await browserApi.storage.local.remove(['enabled', 'patterns']);
  await init();
  setStatus('リセットしました');
}

async function init() {
  const settings = await getSettings();
  document.getElementById('enabled').checked = settings.enabled;
  // 旧形式（*://*.example.com/* など）で保存されたパターンを今の書き方にそろえる
  const normalized = [
    ...new Set(settings.patterns.map(normalizePattern).filter(Boolean))
  ];
  if (normalized.join('\n') !== settings.patterns.join('\n')) {
    await browserApi.storage.local.set({ patterns: normalized });
  }
  patterns = normalized;
  editingIndex = -1;
  renderPatterns();
  updateTestResult();
}

// プロトコルを省略した URL は https として判定する
function updateTestResult() {
  const input = document.getElementById('testUrl').value.trim();
  const out = document.getElementById('testResult');
  if (!input) {
    out.textContent = '';
    return;
  }
  const url = /^[a-z][a-z\d+.-]*:\/\//i.test(input)
    ? input
    : `https://${input}`;
  const enabled = document.getElementById('enabled').checked;
  const matched = enabled && isBlockedUrl(url, patterns);
  out.textContent = matched ? '→ ブロック対象です' : '→ ブロックされません';
}

// ブロックしたドメインを回数の多い順に表示する
async function renderStats() {
  const { domains } = await getStats();
  const ranking = Object.entries(domains).sort((a, b) => b[1] - a[1]);
  const total = ranking.reduce((sum, [, count]) => sum + count, 0);
  const max = ranking[0]?.[1] ?? 0;
  document.getElementById('statsTotal').textContent = total
    ? `累計 ${total} 回ブロックしました`
    : 'まだブロックの記録はありません';
  document.getElementById('ranking').replaceChildren(
    ...ranking.map(([domain, count], i) => {
      // バーは 3 列目の幅に対する割合で長さを決める
      const track = document.createElement('span');
      const bar = createElement('span', 'ranking-bar');
      bar.style.width = `${(count / max) * 100}%`;
      track.append(bar);
      const item = document.createElement('li');
      item.append(
        createElement('span', 'ranking-rank', `${i + 1}.`),
        createElement('span', 'ranking-domain', domain),
        track,
        createElement('span', 'ranking-count', `${count} 回`)
      );
      return item;
    })
  );
}

function resetStats() {
  if (!confirm('ブロックの統計をすべて削除しますか？')) return;
  browserApi.runtime.sendMessage({ type: 'resetStats' }).catch(() => {});
}

document.addEventListener('DOMContentLoaded', async () => {
  await init();
  renderStats();
  document.getElementById('addForm').addEventListener('submit', addPattern);
  document.getElementById('enabled').addEventListener('change', setEnabled);
  document
    .getElementById('testUrl')
    .addEventListener('input', updateTestResult);
  document.getElementById('resetBtn').addEventListener('click', reset);
  document
    .getElementById('resetStatsBtn')
    .addEventListener('click', resetStats);
  // ほかのタブでブロックされたときやリセット時に表示を更新する
  browserApi.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'stats' in changes) renderStats();
  });
});
