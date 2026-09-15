export type VerifiedActionOutcome = "refreshing" | "succeeded";

/**
 * 先执行带权威回执的写入，再尝试刷新页面局部数据。
 * 写入失败继续抛错；写入完成后的刷新失败则返回独立状态，避免把已保存的数据误报为失败。
 */
export async function runVerifiedActionWithRefresh(
  action: () => Promise<void>,
  afterSuccess?: () => Promise<void> | void,
): Promise<VerifiedActionOutcome> {
  await action();

  try {
    await afterSuccess?.();
    return "succeeded";
  } catch {
    return "refreshing";
  }
}
