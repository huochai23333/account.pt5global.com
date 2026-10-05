import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describeTestLog } from './test-run-evidence.mjs';

export async function recordTestRun(command, args = [], options = {}) {
  const startedAt = new Date().toISOString();
  const root = resolve(options.outputRoot ?? 'output/test-runs');
  await mkdir(root, { recursive: true });
  const directory = join(root, `${startedAt.replace(/[:.]/g, '-')}-${randomUUID()}`);
  await mkdir(directory); // 每次使用新目录，不能覆盖上次失败或故障注入的证据。
  const stdout = createWriteStream(join(directory, 'stdout.log'), { flags: 'wx' });
  const stderr = createWriteStream(join(directory, 'stderr.log'), { flags: 'wx' });
  // 子进程写入前监听日志异常；日志未完整落盘时不得生成成功记录。
  const logs = Promise.all([finished(stdout), finished(stderr)]);
  let launchError;
  const child = spawn(command, args, {
    cwd: options.cwd ?? process.cwd(), env: options.env ?? process.env,
    shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  const outcome = await new Promise((accept) => {
    child.once('error', (error) => { launchError = error.code ?? 'launch_failed'; });
    child.once('close', (code, signal) => accept({
      exitCode: Number.isInteger(code) ? code : 1, signal: signal ?? null,
    }));
  });
  await logs;
  // 写流全部关闭后才计算摘要；清单与日志配合核对意外修改或截断。
  const [stdoutEvidence, stderrEvidence] = await Promise.all([
    describeTestLog(join(directory, 'stdout.log')), describeTestLog(join(directory, 'stderr.log')),
  ]);
  const result = {
    schemaVersion: 1,
    startedAt, finishedAt: new Date().toISOString(), ...outcome,
    ...(launchError ? { launchError } : {}),
    logs: { stdout: stdoutEvidence, stderr: stderrEvidence },
  };
  // 不保存参数、环境或身份配置；记录器本身不替子进程脱敏。
  await writeFile(join(directory, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
  return { ...result, directory };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const separator = process.argv.indexOf('--');
  if (separator !== 2 || !process.argv[separator + 1]) {
    console.error('Usage: node scripts/record-test-run.mjs -- <executable> [arguments...]');
    process.exitCode = 1;
  } else {
    try {
      const result = await recordTestRun(process.argv[separator + 1], process.argv.slice(separator + 2));
      console.log(JSON.stringify(result));
      process.exitCode = result.exitCode;
    } catch (error) {
      console.error(`test recording failed: ${error.code ?? error.message}`);
      process.exitCode = 1;
    }
  }
}
