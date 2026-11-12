import type { SupabaseClient } from "@supabase/supabase-js";

import { readPersonPrivateNoteInput, readPersonPrivateNoteReceipt } from "./person-private-note-contract";
import { REQUEST_TIMEOUT_ERROR_NAME, withRequestTimeout } from "./request-timeout";
import { getCurrentSessionContext } from "./user-self-service";
import { isSalesStaffRole } from "./sales-staff-roles";

export type PersonPrivateNoteErrorCode =
  | "forbidden"
  | "invalidInput"
  | "notFound"
  | "serviceUnavailable"
  | "unknown";

export class PersonPrivateNoteMutationError extends Error {
  readonly code: PersonPrivateNoteErrorCode;

  constructor(code: PersonPrivateNoteErrorCode) {
    super(code);
    this.code = code;
  }
}

export async function savePersonPrivateNote(
  supabase: SupabaseClient,
  input: unknown,
) {
  const sessionContext = await getCurrentSessionContext(supabase);

  if (
    !sessionContext.user ||
    sessionContext.status !== "active" ||
    (sessionContext.role !== "administrator" &&
      !isSalesStaffRole(sessionContext.role))
  ) {
    throw new PersonPrivateNoteMutationError("forbidden");
  }

  const payload = readPersonPrivateNoteInput(input);
  if (!payload) throw new PersonPrivateNoteMutationError("invalidInput");

  // 始终使用当前登录身份调用数据库；备注的所有者取自数据库会话。
  const { data, error } = await withRequestTimeout(
    supabase.rpc("save_person_private_note", {
      _note: payload.note,
      _target_user_id: payload.targetUserId,
    }),
  );

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new PersonPrivateNoteMutationError("notFound");
  }

  const savedNote = readPersonPrivateNoteReceipt({
    targetUserId: row.target_user_id,
    note: row.private_note,
    updatedAt: row.updated_at,
  }, payload);
  if (!savedNote) throw new PersonPrivateNoteMutationError("unknown");

  return savedNote;
}

export function getPersonPrivateNoteErrorCode(
  error: unknown,
): PersonPrivateNoteErrorCode {
  if (error instanceof PersonPrivateNoteMutationError) {
    return error.code;
  }

  const message = typeof error === "object" && error !== null && "message" in error
    ? String(error.message).toLowerCase()
    : "";

  if (
    message.includes("person_private_note_forbidden") ||
    message.includes("forbidden") ||
    message.includes("unauthorized")
  ) {
    return "forbidden";
  }

  if (
    message.includes("person_private_note_invalid_input") ||
    message.includes("invalid input")
  ) {
    return "invalidInput";
  }

  if (message.includes("not found")) {
    return "notFound";
  }

  if (
    (error instanceof Error && error.name === REQUEST_TIMEOUT_ERROR_NAME) ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return "serviceUnavailable";
  }

  return "unknown";
}
