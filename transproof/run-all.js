// Runs every transproof test (tests/01..14) sequentially and reports a summary.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'tests');
const files = fs.readdirSync(dir).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
const results = [];
let pass = 0, fail = 0;

for (const f of files) {
  const full = path.join(dir, f);
  process.stdout.write('\n============================================================\n');
  process.stdout.write('RUN ' + f + '\n');
  process.stdout.write('============================================================\n');
  let out = '';
  try {
    out = execFileSync('node', [full], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180000,
      maxBuffer: 64 * 1024 * 1024,
    });
    process.stdout.write(out);
    pass++;
    results.push([f, 'PASS']);
  } catch (e) {
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stdout.write('\n[stderr]\n' + e.stderr);
    fail++;
    results.push([f, 'FAIL']);
    process.stdout.write('\n[runner] ' + f + ' FAILED\n');
  }
}

console.log('\n\n############ SUMMARY ############');
for (const [f, s] of results) console.log('  ' + s + '  ' + f);
console.log('PASS=' + pass + '  FAIL=' + fail + '  TOTAL=' + files.length);
process.exit(fail ? 1 : 0);
