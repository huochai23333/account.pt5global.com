import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getVisibleAnnouncements,
  type AnnouncementRow,
} from "./announcements";
import { withRequestTimeout } from "./request-timeout";
import {
  getCurrentSessionContext,
  type AppRole,
  type UserStatus,
} from "./user-self-service";
import {
  getCurrentSalesmanBusinessBoards,
  type SalesmanBusinessBoard,
} from "./salesman-business-access";
import {
  getCurrentWorkspaceBusinessAccess,
  workspaceBusinessAccessIncludes,
  type WorkspaceBusinessKey,
} from "./workspace-business-access";
import { isSalesStaffRole } from "./sales-staff-roles";
import {
  getUserHomeWidgetLayout,
  type DashboardHomeWidgetLayoutItem,
} from "./dashboard-home-layouts";
import { getUserTodos, type UserTodoItemRow } from "./user-todos";

export type DashboardHomeGreetingPeriod =
  | "morning"
  | "noon"
  | "afternoon"
  | "evening";

export type DashboardHomePageData = {
  announcements: AnnouncementRow[];
  businessBoards: SalesmanBusinessBoard[];
  displayName: string | null;
  greetingPeriod: DashboardHomeGreetingPeriod;
  homeWidgetLayout: DashboardHomeWidgetLayoutItem[] | null;
  layoutScope: string;
  referralCode: string | null;
  role: AppRole | null;
  status: UserStatus | null;
  todos: UserTodoItemRow[];
  workspaceBusinessAccess: WorkspaceBusinessKey[];
};

type HomeProfileRow = {
  email: string | null;
  name: string | null;
  phone: string | null;
  referral_code: string | null;
};

export async function getDashboardHomePageData(
  supabase: SupabaseClient,
): Promise<DashboardHomePageData | null> {
  const { user, role, status } = await getCurrentSessionContext(supabase);

  if (!user) {
    return null;
  }

  const layoutScope = `${role ?? "workspace"}:${user.id}`;
  const businessBoardsPromise: Promise<SalesmanBusinessBoard[]> =
    isSalesStaffRole(role) && status === "active"
      ? getVisibleHomeBusinessBoards(supabase, role)
      : Promise.resolve([]);
  const [profile, announcements, todos, homeLayout, businessBoards, workspaceBusinessAccess] =
    await Promise.all([
      getHomeProfile(supabase, user.id),
      getVisibleAnnouncements(supabase, undefined, { role, status }),
      getUserTodos(supabase, { status, userId: user.id }),
      getUserHomeWidgetLayout(supabase, {
        scope: layoutScope,
        status,
        userId: user.id,
      }),
      businessBoardsPromise,
      getCurrentWorkspaceBusinessAccess(supabase),
    ]);

  return {
    announcements,
    businessBoards,
    displayName:
      profile?.name?.trim() ||
      profile?.email?.trim() ||
      profile?.phone?.trim() ||
      user.email ||
      user.phone ||
      null,
    greetingPeriod: getShanghaiGreetingPeriod(),
    homeWidgetLayout: homeLayout?.widgets ?? null,
    layoutScope,
    referralCode: profile?.referral_code?.trim().toUpperCase() || null,
    role,
    status,
    todos,
    workspaceBusinessAccess,
  };
}

export function getShanghaiGreetingPeriod(
  date: Date = new Date(),
): DashboardHomeGreetingPeriod {
  const hourText = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
  const hour = Number(hourText) % 24;

  if (hour >= 5 && hour < 11) {
    return "morning";
  }

  if (hour >= 11 && hour < 14) {
    return "noon";
  }

  if (hour >= 14 && hour < 18) {
    return "afternoon";
  }

  return "evening";
}

async function getHomeProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("user_profiles")
      .select("name,email,phone,referral_code")
      .eq("user_id", userId)
      .maybeSingle<HomeProfileRow>(),
  );

  if (error) {
    throw error;
  }

  return data;
}

async function getVisibleHomeBusinessBoards(
  supabase: SupabaseClient,
  role: AppRole | null,
) {
  const roleBoard = getFixedSalesStaffBusinessBoard(role);

  if (!roleBoard) {
    return [];
  }

  const [businessBoards, workspaceAccess] = await Promise.all([
    getCurrentSalesmanBusinessBoards(supabase),
    getCurrentWorkspaceBusinessAccess(supabase),
  ]);
  const requiredBusiness = getWorkspaceBusinessForReferralBoard(roleBoard);

  if (!workspaceBusinessAccessIncludes(workspaceAccess, requiredBusiness)) {
    return [];
  }

  return businessBoards.includes(roleBoard) ? [roleBoard] : [];
}

function getFixedSalesStaffBusinessBoard(
  role: AppRole | null,
): SalesmanBusinessBoard | null {
  if (role === "salesman") {
    return "wholesale";
  }

  if (role === "promoter") {
    return "tourism";
  }

  return null;
}

function getWorkspaceBusinessForReferralBoard(
  board: SalesmanBusinessBoard,
): WorkspaceBusinessKey {
  return board === "wholesale" ? "wholesale" : "tourism";
}
