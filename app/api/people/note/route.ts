import { NextResponse } from "next/server";

import {
  getPersonPrivateNoteErrorCode,
  savePersonPrivateNote,
} from "@/lib/person-private-notes";
import { getServerSupabaseClient } from "@/lib/supabase-server";

const STATUS_BY_ERROR_CODE = {
  forbidden: 403,
  invalidInput: 400,
  notFound: 404,
  serviceUnavailable: 503,
  unknown: 500,
} as const;

export async function POST(request: Request) {
  try {
    // 无效 JSON 进入同一输入校验，不会被补成可以清空备注的默认值。
    const payload: unknown = await request.json().catch(() => null);
    const supabase = await getServerSupabaseClient();
    const savedNote = await savePersonPrivateNote(supabase, payload);

    return NextResponse.json(savedNote);
  } catch (error) {
    const code = getPersonPrivateNoteErrorCode(error);

    return NextResponse.json(
      {
        error: code,
      },
      {
        status: STATUS_BY_ERROR_CODE[code],
      },
    );
  }
}
