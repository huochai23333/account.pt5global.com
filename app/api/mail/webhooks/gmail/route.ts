import { after, NextResponse } from "next/server";

import { persistGooglePush, verifyGooglePush } from "@/lib/mail/mail-integrations";
import { processInboundEventBatch } from "@/lib/mail/mail-inbound-worker";
import { processMailNotificationBatch } from "@/lib/mail/mail-notification-worker";

/** Webhook 只验证身份并把事件可靠入队，Gmail 同步由后台处理入口继续执行。 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const event = await verifyGooglePush(request, rawBody);
    const receipt = await persistGooglePush(event);
    if (receipt.created) {
      after(async () => {
        await processInboundEventBatch();
        await processMailNotificationBatch();
      });
    }
    return NextResponse.json(receipt, { status: receipt.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gmail 通知接收失败。" },
      { status: 400 },
    );
  }
}
