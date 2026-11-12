"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { isSalesStaffRole } from "@/lib/sales-staff-roles";
import {
  normalizeSalesmanBusinessBoards,
  type SalesmanBusinessBoard,
} from "@/lib/salesman-business-access";
import { withRequestTimeout } from "@/lib/request-timeout";

/** 读取失败和成功的空权限集合分开；重试只重读本人业务，不增加默认授权。 */
export function useDashboardBusinessReferrals(role: string | null) {
  const supabase = getBrowserSupabaseClient();
  const [boards, setBoards] = useState<SalesmanBusinessBoard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!supabase || !isSalesStaffRole(role)) {
      setBoards([]);
      setLoading(false);
      setLoadFailed(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setLoadFailed(false);
    // 此页面要向用户区分“没有权限”和“暂时没读到”，不能使用吞错后返回 [] 的便利读取。
    void (async () => {
      try {
        const { data, error } = await withRequestTimeout(
          supabase.rpc("get_current_salesman_business_boards"),
        );
        if (error || !Array.isArray(data))
          throw error ?? new Error("invite-read-invalid");
        const nextBoards = normalizeSalesmanBusinessBoards(
          data.map((row) =>
            typeof row === "object" && row !== null && "business_board" in row
              ? row.business_board
              : null,
          ),
        );
        if (mounted) setBoards(nextBoards);
      } catch {
        if (mounted) {
          setBoards([]);
          setLoadFailed(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [attempt, role, supabase]);

  return {
    boards,
    loading,
    loadFailed,
    retry: () => setAttempt((current) => current + 1),
  };
}
