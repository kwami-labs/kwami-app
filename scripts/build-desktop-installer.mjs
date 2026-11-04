// Builds the Windows installer and puts it where kwami.io serves it from, under a fixed name so
// the download button never has to change. Commit the result: the deploy ships what is in public/.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CLOUDFLARE_FILE_LIMIT = 25 * 1024 * 1024;
const BUNDLE_DIR = 'src-tauri/target/release/bundle/nsis';
const TARGET = 'public/downloads/KWAMI-setup.exe';

if (process.platform !== 'win32') {
  console.error('The installer can only be built on Windows.');
  process.exit(1);
}

const build = spawnSync('bunx tauri build --config src-tauri/tauri.release.conf.json', {
  stdio: 'inherit',
  shell: true,
});
if (build.status !== 0) process.exit(build.status ?? 1);

const { version } = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const built = readdirSync(BUNDLE_DIR).find((name) => name === `KWAMI_${version}_x64-setup.exe`);
if (!built) {
  console.error(`No installer for version ${version} in ${BUNDLE_DIR}.`);
  process.exit(1);
}

const source = join(BUNDLE_DIR, built);
const { size } = statSync(source);
if (size > CLOUDFLARE_FILE_LIMIT) {
  console.error(`${built} is ${size} bytes: Cloudflare would refuse the deploy (25 MiB per file).`);
  process.exit(1);
}

mkdirSync('public/downloads', { recursive: true });
copyFileSync(source, TARGET);
console.log(`${TARGET}: ${(size / 1024 / 1024).toFixed(1)} MB`);
