import { PERSON_PRIVATE_NOTE_MAX_LENGTH } from "./person-private-note-constants";

export type PersonPrivateNotePayload = {
  targetUserId: string;
  note: string | null;
};

export function normalizePersonPrivateNote(note: string | null) {
  return note?.trim() || null;
}

export function readPersonPrivateNoteInput(value: unknown): PersonPrivateNotePayload | null {
  if (!isRecord(value) || typeof value.targetUserId !== "string" ||
      (value.note !== null && typeof value.note !== "string")) return null;

  const targetUserId = value.targetUserId.trim().toLowerCase();
  const note = normalizePersonPrivateNote(value.note);
  // 必须显式提供文本或 null。字段缺失、对象和数字都不能解释成清空。
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(targetUserId) ||
      (note && note.length > PERSON_PRIVATE_NOTE_MAX_LENGTH)) return null;

  return { targetUserId, note };
}

export function readPersonPrivateNoteReceipt(value: unknown, expected: PersonPrivateNotePayload) {
  // 同时核对目标、正文和数据库时间。另一行或缺字段的 200 响应不能使页面报成功。
  if (!isRecord(value) || value.targetUserId !== expected.targetUserId ||
      value.note !== expected.note || typeof value.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(value.updatedAt))) return null;

  return { targetUserId: expected.targetUserId, note: expected.note, updatedAt: value.updatedAt };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
