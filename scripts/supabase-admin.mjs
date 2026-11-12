import { createAdminClient } from "./supabase-admin/connection.mjs";
import { readOrder, readSummary, readTable } from "./supabase-admin/read-commands.mjs";
import { updateOrderStatus } from "./supabase-admin/order-status.mjs";

// 命令入口只选择操作和输出结果，连接、查询和写入凭证各自独立维护。
const handlers = {
  summary: (client) => readSummary(client),
  table: (client, args) => readTable(client, ...args),
  order: (client, args) => readOrder(client, ...args),
  updateStatus: (client, args) => updateOrderStatus(client, ...args),
};

const [command = "summary", ...args] = process.argv.slice(2);
try {
  if (!Object.hasOwn(handlers, command)) throw new Error("Unknown command.");
  const result = await handlers[command](createAdminClient(), args);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
