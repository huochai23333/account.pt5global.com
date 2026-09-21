import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { downloadMailAttachment } from "@/lib/mail/mail-service";

import { mailApiError } from "../../_shared";

export async function GET(_request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  try {
    const { attachmentId } = await context.params;
    const file = await downloadMailAttachment(await requireMailIdentity(), attachmentId);
    return new Response(Buffer.from(file.base64, "base64"), {
      headers: {
        "cache-control": "private, no-store",
        "content-type": file.contentType,
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      },
    });
  } catch (error) { return mailApiError(error, "附件暂时无法下载。"); }
}
