import { NextResponse } from "next/server";
import { RequestBodyTooLargeError } from "@/lib/server-request-body";

export function mailApiError(error: unknown, fallback: string) {
  if (error instanceof RequestBodyTooLargeError) {
    return NextResponse.json({ error: "内容超过允许大小，请缩小附件后重试。" }, { status: 413 });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 400 },
  );
}
