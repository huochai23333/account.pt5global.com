import type { AppRole } from "./auth-routing";
import type { UserStatus } from "./user-self-service";

// 筛选控件只依赖记录合同，操作历史和资料查询留在服务端。
export const ADMIN_OPERATION_RECORD_CATEGORIES = [
  "account",
  "profile",
] as const;

export const ADMIN_OPERATION_RECORD_ACTIONS = [
  "account_changed",
  "profile_approved",
  "profile_rejected",
] as const;

export type AdminOperationRecordCategory =
  (typeof ADMIN_OPERATION_RECORD_CATEGORIES)[number];
export type AdminOperationRecordAction =
  (typeof ADMIN_OPERATION_RECORD_ACTIONS)[number];

export type AdminOperationActor = {
  email: string | null;
  name: string | null;
  userId: string | null;
};

export type AdminOperationRecord = {
  action: AdminOperationRecordAction;
  actor: AdminOperationActor;
  category: AdminOperationRecordCategory;
  cityChange: OperationValueChange | null;
  id: string;
  nameChange: OperationValueChange | null;
  note: string | null;
  occurredAt: string;
  roleChange: OperationValueChange<AppRole | null> | null;
  statusChange: OperationValueChange<
    UserStatus | null
  > | null;
  subject: AdminOperationActor;
};

export type AdminOperationRecordsPageData = {
  hasPermission: boolean;
  records: AdminOperationRecord[];
};

type OperationValueChange<T = string | null> = {
  from: T;
  to: T;
};
