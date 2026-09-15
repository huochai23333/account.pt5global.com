import type {
  WorkspaceBusinessKey,
  WorkspaceNavSegment,
} from "@/lib/workspace-config";

export type AdminShellNavLink = {
  badgeCount?: number;
  groupKey?: WorkspaceBusinessKey;
  groupLabel?: string;
  href: string;
  icon: WorkspaceNavSegment;
  label: string;
};

export type AdminShellNavGroup = {
  items: readonly AdminShellNavLink[];
  key: WorkspaceBusinessKey;
  label: string;
};
