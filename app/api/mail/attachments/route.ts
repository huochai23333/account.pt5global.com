import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { uploadMailAttachment } from "@/lib/mail/mail-service";

import { mailApiError } from "../_shared";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { filename?: string; contentType?: string; base64?: string };
    if (!body.filename || !body.base64) throw new Error("附件内容不完整。");
    return NextResponse.json(await uploadMailAttachment(await requireMailIdentity(), {
      filename: body.filename, contentType: body.contentType || "application/octet-stream", base64: body.base64,
    }), { status: 201 });
  } catch (error) { return mailApiError(error, "附件暂时无法上传。"); }
}
