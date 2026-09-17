"use client";

import type { WorkspaceAnnouncementsState } from "@/lib/workspace-announcements";
import type { AppRole } from "@/lib/auth-routing";

import { WorkspaceAnnouncementAction } from "./workspace-announcement-action";
import { WorkspaceAccountMenu } from "./workspace-account-menu";
import { WorkspaceFeedbackButton } from "./workspace-feedback/workspace-feedback-button";

type WorkspaceHeaderActionsProps = {
  accountLabel: string;
  initialAnnouncementsState: WorkspaceAnnouncementsState;
  initials: string;
  myHref: string;
  role: AppRole;
};

/**
 * 顶栏只负责排列三个独立入口。公告读取、账号菜单和意见反馈各自维护状态，
 * 后续修改任意一个入口时，不会再让顶栏组装组件同时承担多种业务职责。
 */
export function WorkspaceHeaderActions({
  accountLabel,
  initialAnnouncementsState,
  initials,
  myHref,
  role,
}: WorkspaceHeaderActionsProps) {
  return (
    <>
      <WorkspaceAnnouncementAction
        initialAnnouncementsState={initialAnnouncementsState}
      />
      <WorkspaceFeedbackButton />
      <WorkspaceAccountMenu
        accountLabel={accountLabel}
        initials={initials}
        myHref={myHref}
        role={role}
      />
    </>
  );
}
