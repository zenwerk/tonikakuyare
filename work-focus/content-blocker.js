// DNR ルールが使えない・まだ適用されていない場合の保険として、
// document_start の時点でブロックページへリダイレクトする。
// manifest で http/https のページにだけ注入される。

/* global getBrowserApi, getSettings, isBlockedUrl */

(async function () {
  const { enabled, patterns } = await getSettings();
  if (!enabled) return;
  const url = location.href;
  if (isBlockedUrl(url, patterns)) {
    const blockedPage = getBrowserApi().runtime.getURL('blocked.html');
    // DNR のリダイレクトと同じく、元の URL をフラグメントで渡す。
    // replace で履歴を置き換え、戻るボタンで再びブロックされないようにする
    location.replace(blockedPage + '#' + url);
  }
})().catch(() => {
  // 拡張の更新直後などで storage にアクセスできない場合は何もしない
});
