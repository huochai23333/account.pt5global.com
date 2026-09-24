import type { ComposerState } from "./use-mail-workspace";

type SavedDraft = { composer: ComposerState; threadId: string | null };

function storageKey(userId: string) {
  // 标签页和登录人双重隔离，避免切换账号时读到别人的邮件内容。
  return `pt5:mail-draft:${userId}`;
}

/** 会话存储只保留可编辑草稿及已上传附件的编号，不保存附件文件内容。 */
export function readMailDraft(userId: string): SavedDraft | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedDraft>;
    const composer = value.composer;
    if (!composer || !["new", "reply"].includes(composer.mode) ||
      ![composer.to, composer.cc, composer.bcc, composer.subject, composer.body].every((part) => typeof part === "string") ||
      !Array.isArray(composer.attachmentIds) || !Array.isArray(composer.attachments)) return null;
    return { composer, threadId: typeof value.threadId === "string" ? value.threadId : null };
  } catch {
    return null;
  }
}

export function writeMailDraft(userId: string, value: SavedDraft | null) {
  try {
    if (value) window.sessionStorage.setItem(storageKey(userId), JSON.stringify(value));
    else window.sessionStorage.removeItem(storageKey(userId));
  } catch {
    // 私密浏览模式禁用存储时，当前页面仍保留内存草稿和离开提示。
  }
}
