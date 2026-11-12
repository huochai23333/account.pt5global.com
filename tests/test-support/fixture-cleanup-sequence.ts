/** 独立资源按顺序回收：前一步失败仍尝试后续步骤，全部错误保留给原用例。 */
export async function cleanupFixtureResources(
  ...steps: (() => Promise<unknown>)[]
) {
  const failures: unknown[] = [];
  // 顺序执行避免两个清理器同时修改同一批行，产生人为的零影响或锁竞争。
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "test_fixture_cleanup_failed");
}
