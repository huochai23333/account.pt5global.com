import type { AppRole } from "./auth-routing";

export type WholesaleCommissionBoard = "salesman" | "referrals";

/** 可用标签由服务端真实身份确定；隐藏按钮不能代替数据读取权限。 */
export function getWholesaleCommissionBoards(role: AppRole | null): WholesaleCommissionBoard[] {
  if (role === "client") return ["referrals"];
  if (role && ["administrator", "manager", "promoter", "salesman", "finance"].includes(role)) {
    return ["salesman", "referrals"];
  }
  return [];
}
