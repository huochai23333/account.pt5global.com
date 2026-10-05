import { verifyTestRun } from './test-run-evidence.mjs';

// 此 CLI 不执行原命令、不读取环境配置；证据缺失和原测试失败都不能返回成功。
if (process.argv.length !== 3) {
  console.error('Usage: node scripts/verify-test-run.mjs <run-directory>');
  process.exitCode = 1;
} else {
  try {
    const result = await verifyTestRun(process.argv[2]);
    console.log(JSON.stringify(result));
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`test evidence verification failed: ${error.code ?? error.message}`);
    process.exitCode = 1;
  }
}
