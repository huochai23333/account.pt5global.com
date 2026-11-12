/** 任务、团队与旅游协作资产：集中实现本模块的一项服务或规则；修改时沿导出追踪调用方，并核对权限与结果边界。 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeTaskScope,
  normalizeTaskStatus,
} from "./admin-task-normalizers";
import type {
  AdminTaskAttachment,
  AdminTaskMainRow,
  TaskScope,
  TaskStatus,
} from "./admin-tasks";
import { getDashboardQueryRange, MAX_DASHBOARD_QUERY_ROWS } from "./dashboard-pagination";
import { withRequestTimeout } from "./request-timeout";
import {
  normalizeInteger,
  normalizeNumericValue,
  normalizeOptionalString,
} from "./value-normalizers";

const TASK_SELECT =
  "id,task_name,task_intro,task_type_code,commission_amount_rmb,acceptance_limit,acceptance_unlimited,review_requires_attachment,created_by_user_id,scope,team_id,status,created_at";
const TASK_ATTACHMENT_SELECT =
  "id,task_id,task_attachment_storage_path,file_size_bytes,original_name,bucket_name,mime_type,uploaded_by_user_id,created_at";

type TaskMainRecord = {
  id: string;
  task_name: string | null;
  task_intro: string | null;
  task_type_code: string | null;
  commission_amount_rmb: number | string | null;
  acceptance_limit: number | string | null;
  acceptance_unlimited: boolean | null;
  review_requires_attachment: boolean | null;
  created_by_user_id: string | null;
  scope: TaskScope | null;
  team_id: string | null;
  status: TaskStatus | null;
  created_at: string | null;
};

type TaskAttachmentRecord = {
  id: string;
  task_id: string | null;
  task_attachment_storage_path: string | null;
  file_size_bytes: number | string | null;
  original_name: string | null;
  bucket_name: string | null;
  mime_type: string | null;
  uploaded_by_user_id: string | null;
  created_at: string | null;
};

export async function getSalesmanTaskMainRows(
  supabase: SupabaseClient,
  limit = MAX_DASHBOARD_QUERY_ROWS,
): Promise<AdminTaskMainRow[]> {
  const { from, to } = getDashboardQueryRange(limit);
  const { data, error } = await withRequestTimeout(
    supabase
      .from("task_main")
      .select(TASK_SELECT)
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<TaskMainRecord[]>(),
  );

  if (error) {
    throw error;
  }

  return normalizeTaskMainRecords(data ?? []);
}

export async function getSalesmanTaskMainRowsByIds(
  supabase: SupabaseClient,
  taskIds: string[],
): Promise<AdminTaskMainRow[]> {
  const normalizedTaskIds = normalizeIdList(taskIds);

  if (normalizedTaskIds.length === 0) {
    return [];
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("task_main")
      .select(TASK_SELECT)
      .in("id", normalizedTaskIds)
      .returns<TaskMainRecord[]>(),
  );

  if (error) {
    throw error;
  }

  return normalizeTaskMainRecords(data ?? []);
}

export async function getVisibleTaskAttachments(
  supabase: SupabaseClient,
  taskIds: string[],
): Promise<AdminTaskAttachment[]> {
  const normalizedTaskIds = normalizeIdList(taskIds);

  if (normalizedTaskIds.length === 0) {
    return [];
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("task_sub")
      .select(TASK_ATTACHMENT_SELECT)
      .in("task_id", normalizedTaskIds)
      .order("created_at", { ascending: true })
      .returns<TaskAttachmentRecord[]>(),
  );

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((item) => normalizeTaskAttachment(item))
    .filter((item): item is AdminTaskAttachment => item !== null);
}

function normalizeTaskMainRecords(values: TaskMainRecord[]) {
  return values
    .map((item) => normalizeTaskMainRecord(item))
    .filter((item): item is AdminTaskMainRow => item !== null);
}

function normalizeTaskMainRecord(value: unknown): AdminTaskMainRow | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const id = "id" in value ? normalizeOptionalString(value.id) : null;
  const taskName = "task_name" in value ? normalizeOptionalString(value.task_name) : null;
  const taskTypeCode =
    "task_type_code" in value ? normalizeOptionalString(value.task_type_code) : null;
  const createdByUserId =
    "created_by_user_id" in value ? normalizeOptionalString(value.created_by_user_id) : null;
  const scope = "scope" in value ? normalizeTaskScope(value.scope) : null;
  const status = "status" in value ? normalizeTaskStatus(value.status) : null;

  if (!id || !taskName || !taskTypeCode || !createdByUserId || !scope || !status) {
    return null;
  }

  return {
    id,
    parent_task_id: null,
    task_name: taskName,
    task_intro: "task_intro" in value ? normalizeOptionalString(value.task_intro) : null,
    task_type_code: taskTypeCode,
    task_type_label: null,
    commission_amount_rmb:
      "commission_amount_rmb" in value
        ? (normalizeNumericValue(value.commission_amount_rmb) ?? 0)
        : 0,
    acceptance_limit: "acceptance_limit" in value ? normalizeInteger(value.acceptance_limit, 1) : 1,
    acceptance_unlimited:
      "acceptance_unlimited" in value ? value.acceptance_unlimited === true : false,
    review_requires_attachment:
      "review_requires_attachment" in value ? value.review_requires_attachment !== false : true,
    accepted_count: "accepted_count" in value ? normalizeInteger(value.accepted_count) : 0,
    completed_count: "completed_count" in value ? normalizeInteger(value.completed_count) : 0,
    created_by_user_id: createdByUserId,
    accepted_by_user_id: null,
    scope,
    team_id: "team_id" in value ? normalizeOptionalString(value.team_id) : null,
    status,
    created_at: "created_at" in value ? normalizeOptionalString(value.created_at) : null,
    accepted_at: null,
    submitted_at: null,
    reviewed_at: null,
    reviewed_by_user_id: null,
    review_reject_reason: null,
    completed_at: null,
  };
}

function normalizeTaskAttachment(value: unknown): AdminTaskAttachment | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const id = "id" in value ? normalizeOptionalString(value.id) : null;
  const taskId = "task_id" in value ? normalizeOptionalString(value.task_id) : null;
  const storagePath =
    "task_attachment_storage_path" in value
      ? normalizeOptionalString(value.task_attachment_storage_path)
      : null;
  const originalName =
    "original_name" in value ? normalizeOptionalString(value.original_name) : null;
  const bucketName = "bucket_name" in value ? normalizeOptionalString(value.bucket_name) : null;
  const mimeType = "mime_type" in value ? normalizeOptionalString(value.mime_type) : null;

  if (!id || !taskId || !storagePath || !originalName || !bucketName || !mimeType) {
    return null;
  }

  return {
    id,
    task_id: taskId,
    task_attachment_storage_path: storagePath,
    file_size_bytes: "file_size_bytes" in value ? normalizeInteger(value.file_size_bytes) : 0,
    original_name: originalName,
    bucket_name: bucketName,
    mime_type: mimeType,
    uploaded_by_user_id:
      "uploaded_by_user_id" in value
        ? (normalizeOptionalString(value.uploaded_by_user_id) ?? "")
        : "",
    created_at: "created_at" in value ? normalizeOptionalString(value.created_at) : null,
  };
}

function normalizeIdList(ids: string[]) {
  return Array.from(
    new Set(ids.map((id) => normalizeOptionalString(id)).filter(Boolean)),
  ) as string[];
}
