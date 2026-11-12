/** 概览只查询总数及最近订单；后台业务表不在命令入口重复列举。 */
export async function readSummary(client) {
  const tables = ["order_overview", "purchase_order", "service_order", "purchase_order_type",
    "service_fee_type", "service_order_type", "order_discount_type", "exchange_rate"];
  const counts = await Promise.all(tables.map(async (table) => {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    return { table, count: count ?? 0 };
  }));
  const { data, error } = await client.from("order_overview")
    .select("order_number,order_status,order_entry_user,ordering_user,amount,original_currency,created_at,deleted_at")
    .order("created_at", { ascending: false }).limit(5);
  if (error) throw new Error(`order_overview preview: ${error.message}`);
  return { counts, recentOrders: data ?? [] };
}

export async function readTable(client, table, limitArg = "20") {
  if (!table) throw new Error("Usage: npm run supabase:admin -- table <table_name> [limit]");
  const limit = Number.parseInt(limitArg, 10);
  if (!Number.isFinite(limit) || limit <= 0) throw new Error("Limit must be a positive integer.");
  const { data, error } = await client.from(table).select("*").limit(limit);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

/** 先按业务编号找到总表，再用真实总表 UUID 查两类子表，保持原输出结构。 */
export async function readOrder(client, number) {
  if (!number) throw new Error("Usage: npm run supabase:admin -- order <order_number>");
  const { data: overview, error } = await client.from("order_overview").select("*").eq("order_number", number).maybeSingle();
  if (error) throw new Error(`order_overview: ${error.message}`);
  if (!overview?.id) return { overview, purchaseOrder: null, serviceOrder: null };
  const [purchase, service] = await Promise.all([
    client.from("purchase_order").select("*").eq("order_overview_id", overview.id).maybeSingle(),
    client.from("service_order").select("*").eq("order_overview_id", overview.id).maybeSingle(),
  ]);
  if (purchase.error) throw new Error(`purchase_order: ${purchase.error.message}`);
  if (service.error) throw new Error(`service_order: ${service.error.message}`);
  return { overview, purchaseOrder: purchase.data, serviceOrder: service.data };
}
