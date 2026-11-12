export type AppRole =
  | "administrator"
  | "operator"
  | "manager"
  | "recruiter"
  | "salesman"
  | "promoter"
  | "finance"
  | "client";

const WORKSPACE_BASE_PATH_BY_ROLE = {
  administrator: "/admin",
  manager: "/manager",
  recruiter: "/recruiter",
  salesman: "/salesman",
  promoter: "/promoter",
  operator: "/operator",
  finance: "/finance",
  client: "/client",
} as const satisfies Record<AppRole, string>;

export type WorkspaceBasePath = (typeof WORKSPACE_BASE_PATH_BY_ROLE)[AppRole];

export const WORKSPACE_BASE_PATHS = [
  "/admin",
  "/manager",
  "/recruiter",
  "/salesman",
  "/promoter",
  "/operator",
  "/finance",
  "/client",
] as const satisfies readonly WorkspaceBasePath[];

// 这是现有导航默认值，不是账号角色；严格服务端入口先 assertWorkspaceRole，不能凭默认值放行。
const UNKNOWN_ROLE_WORKSPACE_BASE_PATHS: readonly WorkspaceBasePath[] = ["/client"];

const WORKSPACE_ACCESS_BY_ROLE = {
  administrator: ["/admin"],
  manager: ["/manager"],
  recruiter: ["/recruiter"],
  salesman: ["/salesman"],
  promoter: ["/promoter"],
  operator: ["/operator"],
  finance: ["/finance"],
  client: ["/client"],
} as const satisfies Record<AppRole, readonly WorkspaceBasePath[]>;

export function getDefaultWorkspaceBasePath(role: AppRole | null): WorkspaceBasePath {
  if (!role) {
    return UNKNOWN_ROLE_WORKSPACE_BASE_PATHS[0];
  }

  return WORKSPACE_BASE_PATH_BY_ROLE[role];
}

export function getAllowedWorkspaceBasePaths(
  role: AppRole | null,
): readonly WorkspaceBasePath[] {
  return role ? WORKSPACE_ACCESS_BY_ROLE[role] : UNKNOWN_ROLE_WORKSPACE_BASE_PATHS;
}

export function canAccessWorkspaceBasePath(
  role: AppRole | null,
  basePath: string,
): boolean {
  return getAllowedWorkspaceBasePaths(role).some(
    (allowedBasePath) => allowedBasePath === basePath,
  );
}

export function getWorkspaceBasePath(pathname: string): WorkspaceBasePath | null {
  for (const basePath of WORKSPACE_BASE_PATHS) {
    if (pathname === basePath || pathname.startsWith(`${basePath}/`)) {
      return basePath;
    }
  }

  return null;
}

export function getDefaultSignedInPathForRole(role: AppRole | null) {
  return `${getDefaultWorkspaceBasePath(role)}/home`;
}
