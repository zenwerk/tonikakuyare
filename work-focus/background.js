// Focus On Your Work - background service worker
// Handles: toggle on icon click, build blocking rules, cross-browser support (DNR or webRequest),
// and sync with options changes.

const browserApi = typeof browser !== 'undefined' ? browser : chrome;

const STORAGE_KEYS = {
  enabled: 'enabled',
  patterns: 'patterns'
};

const DEFAULTS = {
  enabled: true,
  patterns: []
};

// Utility: convert a wildcard pattern with * and ? into a RegExp string
function wildcardToRegex(pattern) {
  // If pattern is like /.../ treat as raw regex (without flags)
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length >= 2) {
    // strip leading/trailing /
    return pattern.slice(1, -1);
  }
  // Escape regex special chars, then replace \* -> .* and \? -> .
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return '^' + escaped + '$';
}

// Cross-browser storage helpers (support Promise and callback styles)
function storageGet(keysOrDefaults) {
  try {
    const maybe = browserApi.storage.local.get(keysOrDefaults);
    if (maybe && typeof maybe.then === 'function') {
      return maybe;
    }
  } catch (e) { /* fall through to callback style */ }
  return new Promise((resolve) => browserApi.storage.local.get(keysOrDefaults, resolve));
}

function storageSet(obj) {
  try {
    const maybe = browserApi.storage.local.set(obj);
    if (maybe && typeof maybe.then === 'function') {
      return maybe;
    }
  } catch (e) { /* fall through to callback style */ }
  return new Promise((resolve) => browserApi.storage.local.set(obj, resolve));
}

async function getSettings() {
  const items = await storageGet(DEFAULTS);
  return {
    enabled: items[STORAGE_KEYS.enabled] ?? items.enabled ?? DEFAULTS.enabled,
    patterns: items[STORAGE_KEYS.patterns] ?? items.patterns ?? DEFAULTS.patterns,
  };
}

function getBlockedPageUrl() {
  return browserApi.runtime.getURL('blocked.html');
}

async function setBadge(enabled) {
  if (!browserApi.action || !browserApi.action.setBadgeText) return;
  await browserApi.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
  await browserApi.action.setBadgeBackgroundColor?.({ color: enabled ? '#2e7d32' : '#9e9e9e' });
}

// DNR support detection
function hasDNR() {
  return !!(browserApi.declarativeNetRequest && browserApi.declarativeNetRequest.updateDynamicRules);
}

// webRequest support detection (blocking)
function hasWebRequestBlocking() {
  return !!(browserApi.webRequest && browserApi.webRequest.onBeforeRequest);
}

// Build rules array for DNR from patterns
function buildDnrRules(patterns) {
  const rules = [];
  let id = 1000;
  const extensionPath = '/blocked.html';
  for (const p of patterns) {
    if (!p || typeof p !== 'string') continue;
    const regex = wildcardToRegex(p.trim());
    try {
      // Validate regex
      new RegExp(regex);
    } catch (e) {
      // skip invalid
      continue;
    }
    rules.push({
      id: id++,
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath } },
      condition: {
        regexFilter: regex,
        resourceTypes: ['main_frame']
      }
    });
  }
  return rules;
}

async function applyBlockingRules(enabled, patterns) {
  // Clear all our dynamic rules first
  if (hasDNR()) {
    const existing = await browserApi.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing.map(r => r.id);
    if (removeRuleIds.length) {
      await browserApi.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    }
    if (enabled) {
      const addRules = buildDnrRules(patterns);
      if (addRules.length) {
        await browserApi.declarativeNetRequest.updateDynamicRules({ addRules });
      }
    }
  } else if (hasWebRequestBlocking()) {
    // Request optional permission if needed (Chrome) - in Firefox it's pre-granted if listed.
    if (browserApi.permissions && browserApi.permissions.request) {
      try { await browserApi.permissions.request({ permissions: ['webRequest', 'webRequestBlocking'], origins: ['<all_urls>'] }); } catch (e) {}
    }
    const blockedPageUrl = getBlockedPageUrl();
    const listener = (details) => {
      const url = details.url;
      // Avoid redirect loops for our own blocked page
      if (url.startsWith(blockedPageUrl)) {
        return {};
      }
      for (const p of patterns) {
        if (!p) continue;
        const rx = new RegExp(wildcardToRegex(p));
        if (rx.test(url)) {
          return { redirectUrl: blockedPageUrl + '?url=' + encodeURIComponent(url) };
        }
      }
      return {};
    };

    // Remove old listener before adding new
    try {
      browserApi.webRequest.onBeforeRequest.removeListener(globalThis.__wf_onBeforeRequest);
    } catch {}

    if (enabled) {
      globalThis.__wf_onBeforeRequest = listener;
      browserApi.webRequest.onBeforeRequest.addListener(
        listener,
        { urls: ['<all_urls>'], types: ['main_frame'] },
        ['blocking']
      );
    }
  }
}

async function refresh() {
  const { enabled, patterns } = await getSettings();
  await setBadge(enabled);
  await applyBlockingRules(enabled, patterns || []);
}

// Toggle on action click
browserApi.action?.onClicked.addListener(async () => {
  const { enabled } = await getSettings();
  const newVal = !enabled;
  await storageSet({ [STORAGE_KEYS.enabled]: newVal });
  await setBadge(newVal);
  await refresh();
});

// React to storage changes
browserApi.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[STORAGE_KEYS.enabled] || changes[STORAGE_KEYS.patterns] || changes.enabled || changes.patterns) {
    refresh();
  }
});

// Initialize on startup/installed
browserApi.runtime.onInstalled.addListener(() => {
  refresh();
});
browserApi.runtime.onStartup?.addListener(() => {
  refresh();
});
