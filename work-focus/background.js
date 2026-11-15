// Focus On Your Work - background script
// アイコンのクリックで ON/OFF を切り替え、設定に合わせて
// declarativeNetRequest の動的ルールとツールバーアイコンを更新する。

/* global getBrowserApi, getSettings, compilePatterns */

// Chrome は service worker として読み込むため shared.js をここで取り込む。
// Firefox は manifest の background.scripts で shared.js を先に読み込む。
if (typeof importScripts === 'function') importScripts('shared.js');

const browserApi = getBrowserApi();

function updateIcon(enabled) {
  const path = enabled ? 'icon_red.png' : 'icon.png';
  return browserApi.action.setIcon({ path }).catch(() => {});
}

function buildRules(patterns) {
  return compilePatterns(patterns).map((regex, i) => ({
    id: 1000 + i,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
    condition: { regexFilter: regex.source, resourceTypes: ['main_frame'] }
  }));
}

async function updateRules(enabled, patterns) {
  // DNR が無い環境（Firefox 113 未満）では content-blocker.js がブロックを担う
  const dnr = browserApi.declarativeNetRequest;
  if (!dnr) return;
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

// 設定変更が続いても getDynamicRules と updateDynamicRules が交互に走って
// ルール ID が衝突しないよう、refresh を 1 つずつ順番に実行する
let refreshing = Promise.resolve();
function scheduleRefresh() {
  refreshing = refreshing.then(refresh).catch(console.error);
}

// 反映は storage.onChanged に任せ、ここでは保存だけ行う
browserApi.action.onClicked.addListener(async () => {
  const { enabled } = await getSettings();
  await browserApi.storage.local.set({ enabled: !enabled });
});

browserApi.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') scheduleRefresh();
});

browserApi.runtime.onInstalled.addListener(scheduleRefresh);
browserApi.runtime.onStartup.addListener(scheduleRefresh);
