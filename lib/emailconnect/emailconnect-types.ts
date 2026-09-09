import type { AppRole } from "@/lib/auth-routing";
import type { UserStatus } from "@/lib/auth-metadata";

export type EmailConnectIdentity = {
  installationId: string;
  externalUserId: string;
  displayName: string;
  role: AppRole;
  status: UserStatus;
};

export type EmailConnectionSummary = {
  feishuBound: boolean;
  feishuName: string | null;
  connections: Array<{
    id: string;
    maskedEmail: string;
    health: "active" | "needs_reauthorization" | "paused" | "disconnected";
    monitorEnabled: boolean;
    watchExpiresAt: string | null;
    lastHealthyAt: string | null;
    lastError: string | null;
  }>;
};

export type EmailPlatformRule = {
  id: string;
  name: string;
  senderDomains: string[];
  subjectKeywords: string[];
  keywordMode: "all" | "any";
  enabled: boolean;
};

export type AdminEmailConnectionHealth = {
  externalUserId: string;
  displayName: string;
  maskedEmail: string | null;
  health: string;
  watchExpiresAt: string | null;
  lastHealthyAt: string | null;
  lastError: string | null;
};
