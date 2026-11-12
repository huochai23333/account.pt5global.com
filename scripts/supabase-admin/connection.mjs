import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/** 显式进程变量优先，其次 .env.local，最后 .env。仅在命令启动时读取配置。 */
export function createAdminClient() {
  const root = path.resolve(import.meta.dirname, "../..");
  loadEnvFile(path.join(root, ".env.local"));
  loadEnvFile(path.join(root, ".env"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  // 管理工具使用特权客户端，不保存登录会话；输出与报错中均不打印连接密钥。
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
