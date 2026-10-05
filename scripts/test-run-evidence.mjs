import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** 按原始字节计算摘要；逐块读取，避免大日志全部进入内存。 */
export async function describeTestLog(path) {
  const digest = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    digest.update(chunk);
    bytes += chunk.length;
  }
  return { bytes, sha256: digest.digest('hex') };
}

/** 核验保存证据的完整性；退出码仍来自实际运行，摘要相同不代表业务测试通过。 */
export async function verifyTestRun(directory) {
  const root = resolve(directory);
  const receipt = JSON.parse(await readFile(join(root, 'result.json'), 'utf8'));
  assert.equal(receipt.schemaVersion, 1, 'test receipt must carry the log evidence schema');
  assert(Number.isInteger(receipt.exitCode), 'test receipt requires a child exit code');
  assert(receipt.signal === null || typeof receipt.signal === 'string', 'test receipt requires a signal outcome');
  assert(receipt.exitCode !== 0 || (!receipt.signal && !receipt.launchError), 'interrupted or unlaunched child cannot succeed');
  // 文件名固定，不接受清单传入的任意路径；只核对当前运行目录的两个日志。
  for (const name of ['stdout', 'stderr']) {
    assert.deepEqual(await describeTestLog(join(root, `${name}.log`)), receipt.logs?.[name],
      `test log integrity mismatch: ${name}`);
  }
  return { directory: root, integrity: 'verified', exitCode: receipt.exitCode, signal: receipt.signal };
}
