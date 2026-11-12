import type { AppRole } from "./auth-routing";
import type { WorkspaceBusinessKey } from "./workspace-business-modules";

export type BusinessVipPageMode = "admin" | "salesman";

export type BusinessVipStatus = "active" | "expired" | "cancelled" | "none";

export type BusinessVipRequestStatus = "pending" | "approved" | "rejected";

export type BusinessVipAdjustmentAction = "set_expires_at" | "cancel";

export type BusinessVipMembershipAction = "open" | "renew";

export type BusinessVipRequest = {
  id: string;
  status: BusinessVipRequestStatus;
  requestedByName: string | null;
  requestedByEmail: string | null;
  note: string | null;
  reviewNote: string | null;
  processedAt: string | null;
  createdAt: string | null;
};

export type BusinessVipRechargeRecord = {
  id: string;
  amount: number | null;
  confirmedByName: string | null;
  currency: string | null;
  confirmedAt: string | null;
  orderNumber: string | null;
  note: string | null;
  nextExpiresAt: string | null;
  operationType: BusinessVipMembershipAction | null;
  previousExpiresAt: string | null;
};

export type BusinessVipAdjustment = {
  id: string;
  action: BusinessVipAdjustmentAction;
  previousStatus: BusinessVipStatus | null;
  previousExpiresAt: string | null;
  nextStatus: BusinessVipStatus;
  nextExpiresAt: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string | null;
};

export type BusinessVipRow = {
  business: WorkspaceBusinessKey;
  targetId: string;
  customerLabel: string;
  contactLabel: string | null;
  secondaryLabel: string | null;
  status: BusinessVipStatus;
  startedAt: string | null;
  expiresAt: string | null;
  latestPaidAt: string | null;
  requests: BusinessVipRequest[];
  rechargeRecords: BusinessVipRechargeRecord[];
  adjustments: BusinessVipAdjustment[];
};

export type BusinessVipPageData = {
  business: WorkspaceBusinessKey;
  canAdmin: boolean;
  canRequest: boolean;
  currentRole: AppRole | null;
  currentUserId: string | null;
  mode: BusinessVipPageMode;
  rows: BusinessVipRow[];
};

export type BusinessVipReviewAction = "approve" | "reject";

export type BusinessVipRequestInput = {
  business: WorkspaceBusinessKey;
  targetId: string;
  note?: string | null;
};

export type BusinessVipReviewInput = {
  action: BusinessVipReviewAction;
  business: WorkspaceBusinessKey;
  note?: string | null;
  requestId: string;
};

export type BusinessVipAdjustmentInput = {
  action: BusinessVipAdjustmentAction;
  business: WorkspaceBusinessKey;
  nextExpiresAt?: string | null;
  note?: string | null;
  targetId: string;
};

export type BusinessVipMembershipInput = {
  action: BusinessVipMembershipAction;
  note?: string | null;
  targetId: string;
};
