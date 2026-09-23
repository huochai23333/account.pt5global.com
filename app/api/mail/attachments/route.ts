import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { uploadMailAttachment } from "@/lib/mail/mail-attachment-service";
import { readLimitedJsonBody } from "@/lib/server-request-body";

import { mailApiError } from "../_shared";

export async function POST(request: Request) {
  try {
    // 先核对登录身份，再按字节上限读取，避免匿名大请求在认证前占满解析内存。
    const identity = await requireMailIdentity();
    const body = await readLimitedJsonBody(request, 14 * 1024 * 1024) as { filename?: string; contentType?: string; base64?: string };
    if (!body.filename || !body.base64) throw new Error("附件内容不完整。");
    return NextResponse.json(await uploadMailAttachment(identity, {
      filename: body.filename, contentType: body.contentType || "application/octet-stream", base64: body.base64,
    }), { status: 201 });
  } catch (error) { return mailApiError(error, "附件暂时无法上传。"); }
}
