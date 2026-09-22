import type { AppRole } from "@/lib/auth-routing";
import type { UserStatus } from "@/lib/auth-metadata";

export type MailIdentity = {
  userId: string;
  displayName: string;
  role: AppRole;
  status: UserStatus;
};

export type MailSenderRole = Extract<AppRole, "administrator" | "salesman">;

export type MailThreadState = "waiting_pt5" | "waiting_customer" | "closed";
export type MailIntakeStatus = "active" | "quarantined";
export type MailIntakeRuleMatcher = "sender" | "domain" | "subject_contains";
export type MailIntakeRuleAction = "allow" | "quarantine";

export type MailWorkspaceSummary = {
  mailbox: {
    maskedEmail: string | null;
    health: "active" | "paused" | "needs_reauthorization" | "not_connected";
    lastHealthyAt: string | null;
    lastError: string | null;
  };
  counts: {
    waitingPt5: number;
    waitingCustomer: number;
    unread: number;
    closed: number;
    unassigned: number;
    quarantined: number;
  };
  canAdminister: boolean;
  feishuBound: boolean;
  senderProfileReady: boolean;
};

export type MailThreadListItem = {
  id: string;
  subject: string;
  customerEmail: string;
  assignedMemberId: string | null;
  assignedDisplayName: string | null;
  state: MailThreadState;
  refCode: string;
  lastMessageAt: string;
  unread: boolean;
  version: number;
};

export type MailMessageView = {
  id: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  textBody: string;
  htmlBody: string;
  occurredAt: string;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    byteSize: number;
    available: boolean;
  }>;
};

export type MailThreadDetail = MailThreadListItem & {
  routingSource: "thread" | "alias" | "ref" | "unassigned" | "manual" | "quarantine";
  nameHintMemberIds: string[];
  messages: MailMessageView[];
};

export type MailThreadQuery = {
  scope: "mine" | "all" | "unassigned";
  state?: MailThreadState;
  unread?: boolean;
  assigneeId?: string;
  customer?: string;
  refCode?: string;
  cursor?: string;
  limit?: number;
};

export type MailAgentProfile = {
  memberId: string;
  displayName: string;
  role: MailSenderRole;
  aliasLocalPart: string;
  refPrefix: string;
  senderDisplayName: string;
  signatureHtml: string;
  feishuBound: boolean;
  enabled: boolean;
  version: number;
  suggestedAliasLocalPart: string;
  suggestedRefPrefix: string;
};

export type MailQuarantineItem = {
  id: string;
  subject: string;
  customerEmail: string;
  assignedMemberId: string | null;
  assignedDisplayName: string | null;
  reason: string;
  quarantinedAt: string;
  lastMessageAt: string;
  version: number;
};

export type MailIntakeRule = {
  id: string;
  matchType: MailIntakeRuleMatcher;
  action: MailIntakeRuleAction;
  pattern: string;
  enabled: boolean;
  hitCount: number;
  version: number;
  updatedAt: string;
};

export type MailQuarantineReceipt = {
  status: "completed" | "partial_failed";
  updated: Array<{ threadId: string; version: number }>;
  failed: Array<{ threadId: string; error: string }>;
  ruleId: string | null;
};

export type OutboundMessageInput = {
  threadId?: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  textBody: string;
  htmlBody: string;
  attachmentIds: string[];
  idempotencyKey: string;
};

export type OutboundJobReceipt = {
  jobId: string;
  status: "pending" | "processing" | "retrying" | "sent" | "partial_failed" | "failed";
  providerMessageId: string | null;
  providerThreadId: string | null;
  lastError: string | null;
};

export type AdminMailMetrics = {
  synchronizationQueue: number;
  outboundQueue: number;
  outboundFailures: number;
  notificationQueue: number;
  unassigned: number;
  waitingPt5: number;
  averageFirstReplyMinutes: number | null;
  quarantined: number;
};
