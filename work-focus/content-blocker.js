// Content-script fallback: if background DNR/webRequest isn't available or hasn't applied yet,
// redirect early at document_start.
const __wf_browser = typeof browser !== 'undefined' ? browser : chrome;

function wildcardToRegex(pattern) {
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length >= 2) {
    return pattern.slice(1, -1);
  }
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return '^' + escaped + '$';
}

(async function () {
  try {
    const loc = window.location;
    if (!/^https?:$/i.test(loc.protocol)) return; // only http/https
    const thisUrl = loc.href;
    const blockedPage = __wf_browser.runtime.getURL('blocked.html');
    if (thisUrl.startsWith(blockedPage)) return; // avoid loops

    const items = await new Promise((resolve) => __wf_browser.storage.local.get({ enabled: true, patterns: [] }, resolve));
    const enabled = items.enabled ?? items['enabled'];
    const patterns = items.patterns ?? items['patterns'] ?? [];
    if (!enabled || !Array.isArray(patterns) || patterns.length === 0) return;

    for (const p of patterns) {
      if (!p) continue;
      const rx = new RegExp(wildcardToRegex(p));
      if (rx.test(thisUrl)) {
        const target = blockedPage + '?url=' + encodeURIComponent(thisUrl);
        // Use replace to prevent back button from re-triggering
        window.location.replace(target);
        return;
      }
    }
  } catch (e) {
    // do nothing
  }
})();
