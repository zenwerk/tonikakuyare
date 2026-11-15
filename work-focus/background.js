// Focus On Your Work - background script
// アイコンのクリックで ON/OFF を切り替え、設定に合わせて
// declarativeNetRequest の動的ルールとツールバーアイコンを更新する。

/* global getBrowserApi, getSettings, getStats, hasHostPermission, compilePatterns, isBlockedUrl */

// Chrome は service worker として読み込むため shared.js をここで取り込む。
// Firefox は manifest の background.scripts で shared.js を先に読み込む。
if (typeof importScripts === 'function') importScripts('shared.js');

const browserApi = getBrowserApi();

const MAX_HISTORY = 1000;

function updateIcon(enabled) {
  const name = enabled ? 'icon-red' : 'icon';
  const path = { 16: `icons/${name}-16.png`, 32: `icons/${name}-32.png` };
  return browserApi.action.setIcon({ path }).catch(() => {});
}

function buildRules(patterns) {
  // regexSubstitution の \0 は「一致した部分」なので、URL 全体に一致するよう
  // パターンを包み、元の URL をブロックページのフラグメントとして渡す
  const blockedPage = browserApi.runtime.getURL('blocked.html');
  return compilePatterns(patterns).map((regex, i) => ({
    id: 1000 + i,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { regexSubstitution: `${blockedPage}#\\0` }
    },
    condition: {
      regexFilter: `^.*(?:${regex.source}).*$`,
      resourceTypes: ['main_frame']
    }
  }));
}

async function updateRules(enabled, patterns) {
  const dnr = browserApi.declarativeNetRequest;
  const existing = await dnr.getDynamicRules();
  // 削除と追加を 1 回の呼び出しにまとめ、ルールが空になる瞬間を作らない
  await dnr.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: enabled ? buildRules(patterns) : []
  });
}

async function refresh() {
  const { enabled, patterns } = await getSettings();
  await Promise.all([updateIcon(enabled), updateRules(enabled, patterns)]);
}

async function recordBlock(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  // ブロックページは web からも開けるので、ブロック対象の URL だけを記録する
  const { patterns } = await getSettings();
  if (!/^https?:$/.test(parsed.protocol) || !isBlockedUrl(url, patterns)) {
    return;
  }
  const stats = await getStats();
  const time = Date.now();
  const domain = parsed.hostname.replace(/^www\./, '');
  stats.history.push({ time, url });
  stats.history.splice(0, stats.history.length - MAX_HISTORY);
  stats.domains[domain] = (stats.domains[domain] ?? 0) + 1;
  stats.hours[new Date(time).getHours()] += 1;
  await browserApi.storage.local.set({ stats });
}

// ルール更新（getDynamicRules → updateDynamicRules）と統計の読み書きが
// 並行して走って結果を上書きし合わないよう、1 つずつ順番に実行する
let queue = Promise.resolve();
function enqueue(task) {
  queue = queue.then(task).catch(console.error);
}

function scheduleRefresh() {
  enqueue(refresh);
}

// 反映は storage.onChanged に任せ、ここでは保存だけ行う
browserApi.action.onClicked.addListener(async () => {
  const { enabled } = await getSettings();
  await browserApi.storage.local.set({ enabled: !enabled });
});

// 統計の書き込みではルールを作り直さない
browserApi.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && ('enabled' in changes || 'patterns' in changes)) {
    scheduleRefresh();
  }
});

// ブロックページとオプションページからの統計の記録・リセット
browserApi.runtime.onMessage.addListener((message) => {
  if (message?.type === 'recordBlock') enqueue(() => recordBlock(message.url));
  if (message?.type === 'resetStats') {
    enqueue(() => browserApi.storage.local.remove('stats'));
  }
});

// サイトへのアクセス権限が無いとブロックが動かないので、オプションページで許可を求める
async function checkHostPermission() {
  if (!(await hasHostPermission())) await browserApi.runtime.openOptionsPage();
}

browserApi.runtime.onInstalled.addListener(() => {
  scheduleRefresh();
  checkHostPermission().catch(console.error);
});
browserApi.runtime.onStartup.addListener(scheduleRefresh);
