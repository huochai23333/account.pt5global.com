import type { DraftMutation, DraftReceipt, TemplateDraft } from "./draft-model";
import type { TemplateDocument } from "./model";
import { canonicalState } from "./model";
/** 页面只接受服务端已独立读回的结果；断线重试必须沿用同一个请求和操作编号。 */
export async function writeDraft(input: DraftMutation) {
  const response = await fetch("/api/company-template-document-drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30000),
  });
  const result = (await response.json()) as {
    error?: string;
    receipt: DraftReceipt;
    draft: TemplateDraft | null;
    document: TemplateDocument | null;
  };
  if (!response.ok) throw new Error(result?.error ?? "document_failed");
  if (
    result?.receipt?.draft_id !== input.draftId ||
    result.receipt.action !== input.action ||
    result.receipt.affected_rows !== 1
  )
    throw new Error("document_not_confirmed");
  if (input.action === "delete" && result.receipt.deleted !== true)
    throw new Error("document_not_confirmed");
  const actual = input.action === "promote" ? result.document : result.draft;
  if (
    input.action === "delete"
      ? actual !== null
      : !actual ||
        actual.id !== input.draftId ||
        actual.revision !== result.receipt.revision ||
        actual.state_sha256 !== result.receipt.state_sha256
  )
    throw new Error("document_not_confirmed");
  if (
    input.action === "promote" &&
    (result.draft !== null || result.document?.folder_id !== input.folderId)
  )
    throw new Error("document_not_confirmed");
  if (
    actual &&
    input.state &&
    canonicalState(actual.state) !== canonicalState(input.state)
  )
    throw new Error("document_not_confirmed");
  return result;
}

/** 关闭待核对的另存为时只读取原记录。仅匹配已发出的转正意图才进入正式文档。 */
export async function readDraftPromotion(
  draft: TemplateDraft,
  intent: DraftMutation,
) {
  const response = await fetch(
    `/api/company-template-document-drafts/${draft.id}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) throw new Error("document_not_confirmed");

  const result = (await response.json()) as {
    draft: TemplateDraft | null;
    document: TemplateDocument | null;
  } | null;
  const currentDraft = result?.draft;
  if (
    result?.document === null &&
    currentDraft?.id === draft.id &&
    currentDraft.owner_id === draft.owner_id &&
    currentDraft.template_version_id === draft.template_version_id
  ) {
    return null;
  }

  const document = result?.document;
  if (
    result?.draft !== null ||
    !document ||
    document.id !== draft.id ||
    document.folder_id !== intent.folderId ||
    document.name !== intent.name?.trim() ||
    document.template_id !== draft.template_id ||
    document.template_version_id !== draft.template_version_id ||
    !Number.isInteger(document.revision) ||
    document.revision < 1 ||
    typeof document.state_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(document.state_sha256) ||
    canonicalState(document.state) !== canonicalState(intent.state)
  ) {
    throw new Error("document_not_confirmed");
  }
  return document;
}
