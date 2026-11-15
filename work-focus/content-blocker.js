// DNR ルールが使えない・まだ適用されていない場合の保険として、
// document_start の時点でブロックページへリダイレクトする。
// manifest で http/https のページにだけ注入される。

/* global getBrowserApi, getSettings, compilePatterns */

(async function () {
  const { enabled, patterns } = await getSettings();
  if (!enabled) return;
  const url = location.href;
  if (compilePatterns(patterns).some((regex) => regex.test(url))) {
    const blockedPage = getBrowserApi().runtime.getURL('blocked.html');
    // replace で履歴を置き換え、戻るボタンで再びブロックされないようにする
    location.replace(blockedPage + '?url=' + encodeURIComponent(url));
  }
})().catch(() => {
  // 拡張の更新直後などで storage にアクセスできない場合は何もしない
});
