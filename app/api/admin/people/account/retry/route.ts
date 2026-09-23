import { NextResponse } from "next/server";

import { syncPendingTargetAuthMetadata } from "@/lib/admin-people-auth-metadata";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentSessionContext } from "@/lib/user-self-service";

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const session = await getCurrentSessionContext(supabase);
  if (!session.user || session.role !== "administrator" || session.status !== "active") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const targetUserId = typeof body === "object" && body !== null && "targetUserId" in body
    ? (body as { targetUserId?: unknown }).targetUserId : null;
  if (typeof targetUserId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {
    return NextResponse.json({ error: "invalidInput" }, { status: 400 });
  }

  // 数据库补偿行提供目标角色和状态；浏览器只能指定人员，不能改写期望值。
  const synced = await syncPendingTargetAuthMetadata(targetUserId);
  return NextResponse.json({ outcome: synced ? "success" : "partial_failed" });
}
