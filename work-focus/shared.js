// background.js / content-blocker.js / options.js で共有するヘルパー。
// バンドラも ES modules も使わず、各スクリプトの前に通常のスクリプトとして読み込む。
// どのコンテキスト（Firefox のコンテンツスクリプトを含む）でもグローバルから見えるよう、
// 外部に公開するのは関数宣言だけにしている。
/* exported getBrowserApi, getSettings, compilePatterns */

const DEFAULT_SETTINGS = { enabled: true, patterns: [] };

function getBrowserApi() {
  return typeof browser !== 'undefined' ? browser : chrome;
}

// 未保存のキーは DEFAULT_SETTINGS の値で補われる
function getSettings() {
  return getBrowserApi().storage.local.get(DEFAULT_SETTINGS);
}

// `/.../` は正規表現（フラグ無し）としてそのまま使い、
// それ以外は `*` と `?` をワイルドカードとして URL 全体に一致させる
function wildcardToRegex(pattern) {
  if (pattern.length >= 2 && pattern.startsWith('/') && pattern.endsWith('/')) {
    return pattern.slice(1, -1);
  }
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return '^' + escaped + '$';
}

// 空行と不正なパターンを除いて RegExp に変換する
function compilePatterns(patterns) {
  const regexes = [];
  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    if (!trimmed) continue;
    try {
      regexes.push(new RegExp(wildcardToRegex(trimmed)));
    } catch {
      // 不正な正規表現は無視する
    }
  }
  return regexes;
}
