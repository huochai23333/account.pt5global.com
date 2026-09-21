import { processInboundEventBatch } from "./mail-inbound-worker";
import { cleanupExpiredMailUploads, recoverInterruptedMailTasks, renewMailWatchIfNeeded } from "./mail-maintenance";
import { processMailNotificationBatch } from "./mail-notification-worker";
import { processOutboundJobBatch } from "./mail-outbound-worker";

/** 单次后台执行按固定顺序处理恢复、收件、发件、通知与维护，并返回各阶段真实计数。 */
export async function processMailQueues() {
  const recoveredCount = await recoverInterruptedMailTasks();
  const inbound = await processInboundEventBatch();
  const outbound = await processOutboundJobBatch();
  const notifications = await processMailNotificationBatch();
  const [renewedWatchCount, cleanedUploadCount] = await Promise.all([
    renewMailWatchIfNeeded(),
    cleanupExpiredMailUploads(),
  ]);
  return { recoveredCount, inbound, outbound, notifications, renewedWatchCount, cleanedUploadCount };
}
