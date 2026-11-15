// background.js / content-blocker.js / options.js / blocked.js で共有するヘルパー。
// バンドラも ES modules も使わず、各スクリプトの前に通常のスクリプトとして読み込む。
// どのコンテキスト（Firefox のコンテンツスクリプトを含む）でもグローバルから見えるよう、
// 外部に公開するのは関数宣言だけにしている。
/* exported getBrowserApi, getSettings, getStats, normalizePattern, compilePatterns, isBlockedUrl */

// patterns の初期値は、インストール直後と「設定をリセット」のあとに使われる
const DEFAULT_SETTINGS = {
  enabled: true,
  patterns: ['x.com', 'posfile.com', 'togetter.com']
};

function getBrowserApi() {
  return typeof browser !== 'undefined' ? browser : chrome;
}

// 未保存のキーは DEFAULT_SETTINGS の値で補われる
function getSettings() {
  return getBrowserApi().storage.local.get(DEFAULT_SETTINGS);
}

// ブロックの記録。history は直近の履歴（{ time, url }）、
// domains（ドメインごとの回数）と hours（0〜23 時ごとの回数）は累積
async function getStats() {
  const { stats } = await getBrowserApi().storage.local.get('stats');
  return stats ?? { history: [], domains: {}, hours: new Array(24).fill(0) };
}

// パターンの書き方:
//   youtube.com   … http/https とサブドメイン（www. など）を含めたドメイン全体
//   x.com/home    … そのパスで始まるページ
//   *  ?          … 任意の文字列 / 任意の 1 文字
//   /正規表現/     … URL 全体に対する正規表現（フラグ無し）
function isRegexPattern(pattern) {
  return (
    pattern.length >= 2 && pattern.startsWith('/') && pattern.endsWith('/')
  );
}

// パターンを上の書き方にそろえる。http(s) は暗黙なので旧形式のプロトコル指定（*:// など）を、
// サブドメインは自動で含めるので先頭の `*.` や `www.` を、パスがドメイン直下だけなら末尾の `/` `/*` を取り除く
function normalizePattern(pattern) {
  const trimmed = pattern.trim();
  if (isRegexPattern(trimmed)) return trimmed;
  const body = trimmed
    .replace(/^[a-z*]+:\/\//i, '')
    .replace(/^(?:\*|www)\./i, '')
    .replace(/^([^/]*)\/\*?$/, '$1');
  const slash = body.indexOf('/');
  return slash === -1
    ? body.toLowerCase()
    : body.slice(0, slash).toLowerCase() + body.slice(slash);
}

// `*` と `?` をワイルドカードにして、それ以外の記号はエスケープする
function wildcardToRegex(text, anyChar) {
  return text.replace(/[.+^${}()|[\]\\*?]/g, (c) =>
    c === '*' ? `${anyChar}*` : c === '?' ? anyChar : `\\${c}`
  );
}

// パターンを URL 全体に一致する正規表現の文字列に変換する（空のパターンは null）
function patternToRegex(pattern) {
  const normalized = normalizePattern(pattern);
  if (!normalized) return null;
  if (isRegexPattern(normalized)) return normalized.slice(1, -1);
  const slash = normalized.indexOf('/');
  const host = (slash === -1 ? normalized : normalized.slice(0, slash)) || '*';
  const path = slash === -1 ? '' : normalized.slice(slash);
  // ホスト部分のワイルドカードは / ? # をまたがない
  const hostRegex = wildcardToRegex(host, '[^/?#]');
  const rest = path ? wildcardToRegex(path, '.') + '.*' : '(?:[/?#].*)?';
  return `^https?://(?:[^/?#]*\\.)?${hostRegex}(?::\\d+)?${rest}$`;
}

// 空のパターンと不正なパターンを除いて RegExp に変換する
function compilePatterns(patterns) {
  const regexes = [];
  for (const pattern of patterns) {
    const source = patternToRegex(pattern);
    if (source === null) continue;
    try {
      regexes.push(new RegExp(source));
    } catch {
      // 不正な正規表現は無視する
    }
  }
  return regexes;
}

function isBlockedUrl(url, patterns) {
  return compilePatterns(patterns).some((regex) => regex.test(url));
}
