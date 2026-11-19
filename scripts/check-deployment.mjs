import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const config = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
assert.equal(config.outputDirectory, 'dist', 'Vercel must serve dist.');
assert.equal(config.framework, null, 'This project uses the Other framework preset.');
assert(existsSync(path.join(dist, 'index.html')), 'Missing homepage.');
assert(existsSync(path.join(dist, '404.html')), 'Missing error page.');

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? files(filename) : [filename];
  });
}

const allFiles = files(dist);
let checkedReferences = 0;
function checkReference(reference, source) {
  if (!reference || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(reference)) return;
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
  if (!clean) return;
  const absolute = clean.startsWith('/')
    ? path.join(dist, clean.slice(1))
    : path.resolve(path.dirname(source), clean);
  const relative = path.relative(dist, absolute);
  assert(!relative.startsWith('..') && !path.isAbsolute(relative), `Asset escapes dist: ${reference}`);
  assert(existsSync(absolute), `Missing local asset ${reference} in ${path.relative(root, source)}`);
  checkedReferences++;
}

for (const filename of allFiles) {
  if (filename.endsWith('.html')) {
    const html = readFileSync(filename, 'utf8');
    assert(/<meta\s+charset=["']?utf-8/i.test(html), `Missing UTF-8 declaration: ${filename}`);
    for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) checkReference(match[1], filename);
    const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size, `Duplicate HTML IDs in ${filename}`);
  }
  if (filename.endsWith('.css')) {
    for (const match of readFileSync(filename, 'utf8').matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/g)) checkReference(match[1] ?? match[2] ?? match[3], filename);
  }
  if (filename.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', filename], { encoding: 'utf8' });
    assert.equal(result.status, 0, `Invalid JavaScript: ${path.relative(root, filename)}\n${result.stderr}`);
  }
}

const photoCatalog = JSON.parse(readFileSync(path.join(root, 'scripts/photo-catalog.json'), 'utf8'));
const sources = photoCatalog.assignments.map(photo => photo.source);
assert.equal(new Set(sources).size, sources.length, 'A source photograph is assigned more than once.');
for (const [role, count] of Object.entries({ intro: 14, hero: 5, gallery: 8, story: 3, 'story-thumb': 3, about: 3, category: 7 })) {
  assert.equal(photoCatalog.assignments.filter(photo => photo.role === role).length, count, `Expected ${count} curated ${role} photos.`);
}
for (const photo of photoCatalog.assignments) {
  assert(existsSync(path.join(dist, photo.asset)), `Missing curated photograph ${photo.asset}.`);
}

// The gallery and cinematic intro reference these files dynamically.
for (let photo = 1; photo <= 8; photo++) {
  assert(existsSync(path.join(dist, `assets/photo-${photo}.jpg`)), `Missing photograph ${photo}.`);
}
for (let photo = 1; photo <= 14; photo++) assert(existsSync(path.join(dist, `assets/intro-photo-${photo}.jpg`)), `Missing intro photograph ${photo}.`);
for (const name of ['camera-shutter', 'soft-scroll']) {
  const animation = JSON.parse(readFileSync(path.join(dist, `assets/lottie/${name}.json`), 'utf8'));
  assert(animation.layers?.length && animation.op > animation.ip, `Invalid Lottie asset: ${name}`);
}
const bytes = allFiles.reduce((total, filename) => total + statSync(filename).size, 0);
console.log(`Deployment check passed: ${allFiles.length} static files, ${checkedReferences} local references, ${(bytes / 1024 / 1024).toFixed(2)} MB.`);
console.log('Ready for Vercel: framework Other, output dist, no dependencies or environment variables.');
