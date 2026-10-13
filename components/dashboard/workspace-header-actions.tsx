"use client";

import type { WorkspaceAnnouncementsState } from "@/lib/workspace-announcements";
import type { AppRole } from "@/lib/auth-routing";

import { WorkspaceAnnouncementAction } from "./workspace-announcement-action";
import { WorkspaceAccountMenu } from "./workspace-account-menu";

type WorkspaceHeaderActionsProps = {
  accountLabel: string;
  initialAnnouncementsState: WorkspaceAnnouncementsState;
  initials: string;
  myHref: string;
  role: AppRole;
};

/**
 * 顶栏只负责排列公告和账号入口；两个模块分别维护自己的读取与交互状态，
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
      <WorkspaceAccountMenu
        accountLabel={accountLabel}
        initials={initials}
        myHref={myHref}
        role={role}
      />
    </>
  );
}
