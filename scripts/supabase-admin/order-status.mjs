const allowedStatuses = ["pending", "in_progress", "settled", "completed", "cancelled", "refunding"];

/** 写入必须命中一条订单，且返回同一业务编号和提交后的状态。 */
export async function updateOrderStatus(client, number, status) {
  if (!number || !allowedStatuses.includes(status)) {
    throw new Error("Usage: npm run supabase:admin -- updateStatus <order_number> <pending|in_progress|settled|completed|cancelled|refunding>");
  }
  const { data, error } = await client.from("order_overview").update({ order_status: status })
    .eq("order_number", number).select("*").maybeSingle();
  if (error) throw new Error(`order_overview update: ${error.message}`);
  if (!data) throw new Error("订单没有更新，请确认订单编号。");
  if (typeof data.id !== "string" || !data.id || data.order_number !== number || data.order_status !== status) {
    throw new Error("订单更新回执与本次提交不一致，请重新查询订单。");
  }
  // 写后独立读取必须一致。无法读回时提示先查询，避免重复提交已经发生的更新。
  const { data: verified, error: readError } = await client.from("order_overview").select("*").eq("id", data.id).maybeSingle();
  if (readError || !verified) throw new Error("订单写入后暂时无法核对，请先重新查询该订单。");
  if (verified.id !== data.id || verified.order_number !== number || verified.order_status !== status) {
    throw new Error("订单写入后的核对结果不一致，请重新查询该订单。");
  }
  return verified;
}
