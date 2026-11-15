// ブロック元の URL をブロックページに表示する
const url = new URLSearchParams(location.search).get('url');
if (url) document.getElementById('url').textContent = url;
