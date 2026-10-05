import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { recordTestRun } from './record-test-run.mjs';

const scratch = await mkdtemp(join(tmpdir(), 'pt5-record-test-'));
const read = (directory, name) => readFile(join(directory, name), 'utf8');

test('successful executable preserves stdout and stderr separately', async () => {
  const result = await recordTestRun(process.execPath, ['-e', "console.log('fixed stdout');console.error('fixed stderr')"], { outputRoot: scratch });
  assert.equal(result.exitCode, 0);
  assert.equal(result.signal, null);
  assert.equal(await read(result.directory, 'stdout.log'), 'fixed stdout\n');
  assert.equal(await read(result.directory, 'stderr.log'), 'fixed stderr\n');
  const receipt = JSON.parse(await read(result.directory, 'result.json'));
  assert.equal(receipt.exitCode, 0);
  assert.equal('env' in receipt, false);
  assert.equal('args' in receipt, false);
});

test('concurrent executions have distinct directories and retain both outcomes', async () => {
  const results = await Promise.all([0, 7].map((code) => recordTestRun(process.execPath,
    ['-e', `console.log('run-${code}');process.exit(${code})`], { outputRoot: scratch })));
  assert.notEqual(results[0].directory, results[1].directory);
  assert.equal(results[0].exitCode, 0);
  assert.equal(results[1].exitCode, 7);
  for (const [i, code] of [0, 7].entries()) {
    assert.equal(await read(results[i].directory, 'stdout.log'), `run-${code}\n`);
    assert.equal(JSON.parse(await read(results[i].directory, 'result.json')).exitCode, code);
  }
});

test('missing executable produces a failing saved receipt', async () => {
  const result = await recordTestRun(join(scratch, 'missing-executable'), [], { outputRoot: scratch });
  assert.notEqual(result.exitCode, 0);
  assert.equal(result.launchError, 'ENOENT');
  assert.notEqual(JSON.parse(await read(result.directory, 'result.json')).exitCode, 0);
});

test('CLI preserves the child failure code rather than returning success', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./record-test-run.mjs', import.meta.url)),
    '--', process.execPath, '-e', "console.error('fixed child failure');process.exit(7)"],
  { cwd: scratch, encoding: 'utf8' });
  assert.equal(result.status, 7);
  assert.equal(JSON.parse(result.stdout.trim()).exitCode, 7);
});

test('CLI missing command cannot report success', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./record-test-run.mjs', import.meta.url))],
    { cwd: scratch, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
});

test('CLI recording failure rejects even a command that would succeed', async () => {
  const blocked = await mkdtemp(join(tmpdir(), 'pt5-record-blocked-'));
  await writeFile(join(blocked, 'output'), 'synthetic file blocks the output directory');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./record-test-run.mjs', import.meta.url)),
    '--', process.execPath, '-e', "console.log('child must not run')"],
  { cwd: blocked, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /test recording failed:/);
});
