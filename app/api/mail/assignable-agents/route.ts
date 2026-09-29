import { NextResponse } from "next/server";
import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { listAssignableMailAgents } from "@/lib/mail/mail-service";
import { mailApiError } from "../_shared";

/** 会话转交只需要可接收邮件的人员姓名与编号，不读取他人的私有发件设置。 */
export async function GET() {
  try { return NextResponse.json(await listAssignableMailAgents(await requireMailIdentity())); }
  catch (error) { return mailApiError(error, "邮件负责人暂时无法读取。"); }
}
