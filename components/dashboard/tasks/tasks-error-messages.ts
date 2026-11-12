import { getRawErrorMessage } from "@/components/dashboard/dashboard-shared-errors";

import type { TranslateFn } from "./tasks-display";

export function toAdminTaskErrorMessage(error: unknown, t: TranslateFn) {
  const rawMessage = getRawErrorMessage(error);

  if (rawMessage.includes("task_main_task_name_not_blank")) {
    return t("errors.admin.taskNameBlank");
  }

  if (rawMessage.includes("task_main_scope_team_check")) {
    return t("errors.admin.teamRequired");
  }

  if (rawMessage.includes("task_main_task_type_code_fkey")) {
    return t("errors.admin.taskTypeRequired");
  }

  if (rawMessage.includes("invalid task target roles")) {
    return t("errors.admin.targetRolesRequired");
  }

  if (rawMessage.includes("task target roles can only be changed before acceptance")) {
    return t("errors.admin.targetRolesLocked");
  }

  if (rawMessage.includes("task target roles not confirmed")) {
    return t("errors.admin.targetRolesUnconfirmed");
  }

  if (rawMessage.includes("task type display name is required")) {
    return t("errors.admin.taskTypeNameRequired");
  }

  if (rawMessage.includes("task type default commission must be nonnegative")) {
    return t("errors.admin.commissionAmountInvalid");
  }

  if (rawMessage.includes("task type not found")) {
    return t("errors.admin.taskTypeRequired");
  }

  if (rawMessage.includes("task type write not confirmed")) {
    return t("errors.admin.taskTypeUnconfirmed");
  }

  if (rawMessage.includes("task_main_commission_amount_nonnegative")) {
    return t("errors.admin.commissionAmountInvalid");
  }

  if (rawMessage.includes("task acceptance limit invalid")) {
    return t("errors.admin.acceptanceLimitInvalid");
  }

  if (rawMessage.includes("task acceptance limit below accepted count")) {
    return t("errors.admin.acceptanceLimitBelowAccepted");
  }

  if (rawMessage.includes("authenticated user is required")) {
    return t("errors.admin.authExpired");
  }

  if (rawMessage.includes("only administrator")) {
    return t("errors.admin.noPermission");
  }

  if (rawMessage.includes("task not found")) {
    return t("errors.admin.taskNotFound");
  }

  if (rawMessage.includes("task delete did not confirm the requested row")) {
    return t("errors.admin.taskDeleteUnconfirmed");
  }

  if (rawMessage.includes("completed task cannot be edited")) {
    return t("errors.admin.taskCompletedReadOnly");
  }

  if (rawMessage.includes("completed task cannot be deleted")) {
    return t("errors.admin.taskCompletedReadOnly");
  }

  if (rawMessage.includes("duplicate key value violates unique constraint")) {
    return t("errors.admin.duplicateAttachmentPath");
  }

  if (rawMessage.includes("admin_task_attachments_count_exceeded")) {
    return t("errors.admin.attachmentCountExceeded");
  }

  if (rawMessage.includes("admin_task_attachment_empty")) {
    return t("errors.admin.attachmentEmpty");
  }

  if (rawMessage.includes("admin_task_attachment_too_large")) {
    return t("errors.admin.attachmentTooLarge");
  }

  if (rawMessage.includes("admin_task_attachments_total_too_large")) {
    return t("errors.admin.attachmentTotalTooLarge");
  }

  if (rawMessage.includes("admin_task_attachment_type_not_allowed")) {
    return t("errors.admin.attachmentTypeNotAllowed");
  }

  if (rawMessage.includes("storage")) {
    return t("errors.admin.storage");
  }

  return t("errors.admin.unknown");
}

export function toSalesmanTaskErrorMessage(error: unknown, t: TranslateFn) {
  const rawMessage = getRawErrorMessage(error);

  if (rawMessage.includes("current user cannot accept this task")) {
    return t("errors.salesman.cannotAccept");
  }

  if (rawMessage.includes("task is not available for acceptance")) {
    return t("errors.salesman.alreadyAccepted");
  }

  if (rawMessage.includes("current user already accepted this task")) {
    return t("errors.salesman.alreadyAcceptedByMe");
  }

  if (rawMessage.includes("task acceptance limit reached")) {
    return t("errors.salesman.acceptanceFull");
  }

  if (rawMessage.includes("current user cannot complete this task")) {
    return t("errors.salesman.cannotComplete");
  }

  if (rawMessage.includes("task is not in accepted status")) {
    return t("errors.salesman.notAccepted");
  }

  if (rawMessage.includes("current user cannot create task review submission")) {
    return t("errors.salesman.cannotCreateReviewSubmission");
  }

  if (rawMessage.includes("current user cannot submit task review")) {
    return t("errors.salesman.cannotSubmitReview");
  }

  if (rawMessage.includes("task review submission assets are required")) {
    return t("errors.salesman.reviewAssetsRequired");
  }

  if (rawMessage.includes("task review submission note is required")) {
    return t("errors.salesman.reviewNoteRequired");
  }

  if (rawMessage.includes("task review submission not found")) {
    return t("errors.salesman.reviewSubmissionMissing");
  }

  if (rawMessage.includes("task review submission is not draft")) {
    return t("errors.salesman.reviewSubmissionInvalid");
  }

  if (rawMessage.includes("task review submission_files_required")) {
    return t("errors.salesman.reviewFilesRequired");
  }

  if (rawMessage.includes("task_review_submission_files_required")) {
    return t("errors.salesman.reviewFilesRequired");
  }

  if (rawMessage.includes("task_review_submission_attachments_count_exceeded")) {
    return t("errors.salesman.reviewAttachmentCountExceeded");
  }

  if (rawMessage.includes("task_review_submission_attachment_empty")) {
    return t("errors.salesman.reviewAttachmentEmpty");
  }

  if (rawMessage.includes("task_review_submission_attachment_too_large")) {
    return t("errors.salesman.reviewAttachmentTooLarge");
  }

  if (rawMessage.includes("task_review_submission_attachments_total_too_large")) {
    return t("errors.salesman.reviewAttachmentTotalTooLarge");
  }

  if (rawMessage.includes("task_review_submission_attachment_type_not_allowed")) {
    return t("errors.salesman.reviewAttachmentTypeNotAllowed");
  }

  if (rawMessage.includes("current user is not active")) {
    return t("errors.salesman.inactive");
  }

  return t("errors.salesman.unknown");
}
