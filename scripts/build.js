// Chrome 用（dist/work-focus.zip）と Firefox 用（dist/work-focus.xpi）のパッケージを作る。
//
// work-focus/manifest.json は、開発中にどちらのブラウザでもそのまま読み込めるよう
// background に service_worker（Chrome）と scripts（Firefox）の両方を書いている。
// ストアの審査で「使わないキー」として警告されないよう、パッケージでは
// それぞれのブラウザが使わないキーを取り除いた manifest にする。

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'work-focus');
const dist = path.join(root, 'dist');

const targets = [
  {
    output: 'work-focus.zip',
    transform(manifest) {
      delete manifest.background.scripts;
      delete manifest.browser_specific_settings;
    }
  },
  {
    output: 'work-focus.xpi',
    transform(manifest) {
      delete manifest.background.service_worker;
    }
  }
];

fs.rmSync(dist, { recursive: true, force: true });

for (const { output, transform } of targets) {
  const stage = path.join(dist, `${output}.tmp`);
  fs.cpSync(source, stage, {
    recursive: true,
    filter: (file) => path.basename(file) !== '.DS_Store'
  });

  const manifestPath = path.join(stage, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  transform(manifest);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // アーカイブのルート直下に manifest.json が来るよう、ステージングの中で圧縮する
  execFileSync('zip', ['-r', '-q', path.join(dist, output), '.'], {
    cwd: stage
  });
  fs.rmSync(stage, { recursive: true });
  console.log(`dist/${output}`);
}
