// ブロックした元のページへのリンクと、そのページのタイトルを表示する

/* global getBrowserApi, getSettings, isBlockedUrl */

// 元の URL は DNR / content-blocker.js から `blocked.html#<元のURL>` の形で渡される。
// このページは web からも開けるため、http(s) 以外（javascript: など）は扱わない
function getOriginalUrl() {
  try {
    const url = new URL(location.hash.slice(1));
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

// Content-Type ヘッダか <meta> の charset で HTML をデコードする（Shift_JIS や EUC-JP のページ向け）
function decodeHtml(response, bytes) {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const match =
    /charset=["']?([\w-]+)/i.exec(response.headers.get('content-type')) ||
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head);
  try {
    return new TextDecoder(match ? match[1] : 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

async function fetchTitle(url) {
  const response = await fetch(url, {
    credentials: 'omit',
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return '';
  if (!response.headers.get('content-type')?.includes('text/html')) return '';
  const bytes = new Uint8Array(await response.arrayBuffer());
  const html = decodeHtml(response, bytes);
  return new DOMParser().parseFromString(html, 'text/html').title.trim();
}

(async function () {
  const url = getOriginalUrl();
  if (!url) return;
  document.getElementById('originLink').href = url;
  document.getElementById('originUrl').textContent = url;
  document.getElementById('origin').hidden = false;

  // 再読み込みや戻る/進むで開き直しただけのときは記録しない
  const navigation = performance.getEntriesByType('navigation')[0];
  if (!['reload', 'back_forward'].includes(navigation?.type)) {
    getBrowserApi()
      .runtime.sendMessage({ type: 'recordBlock', url })
      .catch(() => {});
  }

  // 外部のページにこのページを開かせて任意の URL を取得させないよう、
  // タイトルを取得するのはブロック対象のパターンに一致する URL だけにする
  const { patterns } = await getSettings();
  if (!isBlockedUrl(url, patterns)) return;
  document.getElementById('originTitle').textContent = await fetchTitle(url);
})().catch(() => {
  // タイトルを取得できなくても URL のリンクは表示済みなので何もしない
});
