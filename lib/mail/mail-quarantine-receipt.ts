type QuarantineTarget = { threadId: string; expectedVersion: number };
type QuarantineUpdate = { threadId: string; version: number };

/** 逐个核对编号与下一版本。同样数量的错误会话、重复会话或旧版本都不是完整回执。 */
export function matchesQuarantineUpdates(targets: QuarantineTarget[], updates: unknown): updates is QuarantineUpdate[] {
  if (!Array.isArray(updates) || targets.length === 0 || updates.length !== targets.length) return false;
  const pending = new Map(targets.map(({ threadId, expectedVersion }) => [threadId, expectedVersion + 1]));
  if (pending.size !== targets.length) return false;

  for (const update of updates) {
    if (!update || typeof update.threadId !== "string" || !Number.isSafeInteger(update.version)) return false;
    if (pending.get(update.threadId) !== update.version) return false;
    pending.delete(update.threadId);
  }
  return pending.size === 0;
}
