import { NextResponse } from "next/server";
import { requireMailIdentity } from "@/lib/mail/mail-identity";
import type { MailIdentity } from "@/lib/mail/mail-types";
import { MailConfirmedRejection } from "@/lib/mail/mail-confirmed-rejection";
import { readLimitedJsonBody, RequestBodyTooLargeError } from "@/lib/server-request-body";

/** 所有邮件写入口先核对身份，再按实际读取字节数限制 JSON 大小。 */
export async function readAuthenticatedMailJson<T>(request: Request, maxBytes = 64 * 1024): Promise<{ identity: MailIdentity; body: T }> {
  const identity = await requireMailIdentity();
  const body = await readLimitedJsonBody(request, maxBytes) as T;
  return { identity, body };
}

export function mailApiError(error: unknown, fallback: string) {
  if (error instanceof MailConfirmedRejection) {
    return NextResponse.json({ error: error.message, code: "confirmed_rejection" }, { status: 422 });
  }
  if (error instanceof RequestBodyTooLargeError) {
    // 请求体在创建发送任务前就被拒绝，可以安全释放本次发送标识供修改后重试。
    return NextResponse.json({ error: "提交内容超过允许大小，请缩短文字或减少附件后重试。", code: "confirmed_rejection" }, { status: 413 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "提交内容无法读取，请刷新页面后重试。" }, { status: 400 });
  }
  if (error instanceof Error && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) {
    return NextResponse.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  }
  return NextResponse.json(
    { error: error instanceof Error && /[\u3400-\u9fff]/u.test(error.message) ? error.message : fallback },
    { status: 400 },
  );
}
