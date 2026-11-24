// CI-10: run each _src/test*.mjs one at a time and judge it.
// A test FAILS if it exits non-zero, times out, prints no JSON result, or its result has a non-empty errs list.
// usage: node _src/suite-judge.mjs <outDir> <shotsDir>
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
const [OUT = 'out', SHOTS = 'shots'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
const dir = path.dirname(new URL(import.meta.url).pathname);
const tests = fs.readdirSync(dir).filter(f => /^test.*\.mjs$/.test(f)).sort();
const args = { 'test-share.mjs': [SHOTS] };
const lastJson = s => { const i = s.lastIndexOf('\n{') >= 0 ? s.lastIndexOf('\n{') + 1 : s.indexOf('{'); if (i < 0) return null; try { return JSON.parse(s.slice(i)) } catch { return null } };
const errsOf = o => { if (!o || typeof o !== 'object') return []; const e = [...(Array.isArray(o.errs) ? o.errs : [])]; if (o.R && Array.isArray(o.R.errs)) e.push(...o.R.errs); return e };
let fail = 0; const summary = [];
for (const t of tests) {
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(dir, t), ...(args[t] || [])], { encoding: 'utf8', timeout: 6 * 60_000, env: { ...process.env, SHOTS } });
  const out = (r.stdout || '') + (r.stderr ? '\n--- stderr ---\n' + r.stderr : '');
  fs.writeFileSync(path.join(OUT, t + '.log'), out);
  const res = lastJson(r.stdout || ''); const errs = errsOf(res);
  let why = '';
  if (r.error) why = 'error ' + r.error.code;
  else if (r.status !== 0) why = 'exit ' + r.status;
  else if (!res) why = 'no JSON result';
  else if (errs.length) why = errs.length + ' errs: ' + errs.slice(0, 3).join(' | ');
  const line = `${why ? 'FAIL' : 'PASS'} ${t} (${Math.round((Date.now() - t0) / 1000)}s)${why ? ' ' + why : ''}`;
  console.log(line); console.log((r.stdout || '').slice(-1500)); summary.push(line); if (why) fail = 1;
}
fs.writeFileSync(path.join(OUT, 'SUMMARY.txt'), summary.join('\n') + '\n');
console.log('\n' + summary.join('\n'));
process.exit(fail);
