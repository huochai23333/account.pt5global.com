import { NextResponse } from "next/server";

import {
  acquireApiRequestQuota,
  releaseApiRequestQuota,
} from "@/lib/api-request-quota";
import { getServerAuthContext } from "@/lib/server-auth";
import {
  readLimitedJsonBody,
  RequestBodyTooLargeError,
} from "@/lib/server-request-body";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { normalizeWholesale1688ApiPayload } from "@/lib/wholesale-1688-ingest";
import { getCurrentWorkspaceBusinessAccess } from "@/lib/workspace-business-access";

const WHOLESALE_INGEST_ROLES = new Set(["administrator", "salesman", "promoter"]);
const MAX_1688_BODY_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const { role, status, userId } = await getServerAuthContext();
  const supabase = await getServerSupabaseClient();

  if (!userId || status !== "active") {
    return NextResponse.json(
      { error: "请先登录后再接收采购订单。" },
      { status: 401 },
    );
  }

  const businessAccess = await getCurrentWorkspaceBusinessAccess(supabase);

  if (
    !role ||
    !WHOLESALE_INGEST_ROLES.has(role) ||
    !businessAccess.includes("wholesale")
  ) {
    return NextResponse.json(
      { error: "当前账号不能接收批发采购订单。" },
      { status: 403 },
    );
  }

  let leaseId: string | null = null;

  try {
    const payload = normalizeWholesale1688ApiPayload(
      await readLimitedJsonBody(request, MAX_1688_BODY_BYTES),
    );

    if (payload.rows.length === 0) {
      return NextResponse.json(
        { error: "没有可接收的采购订单。" },
        { status: 400 },
      );
    }

    const quota = await acquireApiRequestQuota(supabase, "wholesale_1688");

    if (!quota.allowed) {
      return NextResponse.json(
        { error: "接收操作有些频繁，请稍后再试。" },
        {
          headers: { "Retry-After": String(quota.retryAfterSeconds) },
          status: 429,
        },
      );
    }

    leaseId = quota.leaseId;

    const { data: batch, error: batchError } = await supabase
      .from("wholesale_1688_import_batches")
      .insert({
        file_name: payload.fileName,
        row_count: payload.rows.length,
        source: payload.source,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: "采购订单没有接收成功，请稍后再试。" },
        { status: 400 },
      );
    }

    // verified-write: 写入后会按本批唯一订单号重新查询，并逐条核对实际落库结果。
    const { error } = await supabase.from("wholesale_1688_orders").upsert(
      payload.rows.map((row) => ({
        ...row,
        batch_id: batch.id,
      })),
      { ignoreDuplicates: true, onConflict: "external_order_number" },
    );

    if (error) {
      return NextResponse.json(
        { error: "采购订单没有接收成功，请检查内容后再试。" },
        { status: 400 },
      );
    }

    const expectedOrderNumbers = [
      ...new Set(payload.rows.map((row) => row.external_order_number)),
    ];
    const { data: verifiedOrders, error: verificationError } = await supabase
      .from("wholesale_1688_orders")
      .select("external_order_number")
      .in("external_order_number", expectedOrderNumbers);
    if (verificationError || verifiedOrders?.length !== expectedOrderNumbers.length) {
      return NextResponse.json(
        { error: "部分采购订单没有确认保存，请稍后重试。" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      message: "采购订单已接收。",
      receivedCount: verifiedOrders.length,
      batchId: batch.id,
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: "一次接收的内容太大，请拆分后再试。" },
        { status: 413 },
      );
    }

    if (error instanceof Error && error.message === "too_many_rows") {
      return NextResponse.json(
        { error: "一次最多接收 500 行，请拆分后再试。" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "采购订单暂时没有接收成功，请稍后再试。" },
      { status: 503 },
    );
  } finally {
    await releaseApiRequestQuota(supabase, leaseId);
  }
}
