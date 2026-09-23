import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

/**
 * recovery 回归需要生成一次性链接，但不能真的发送邮件或把管理密钥交给浏览器。
 * 这个客户端只在 Playwright 的 Node.js 测试进程中创建，并且只接受本地 Supabase 地址。
 */
export function getLocalSupabaseAdminClient() {
  const supabaseUrl = readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readLocalEnvValue("SUPABASE_SERVICE_ROLE_KEY");

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/i.test(supabaseUrl)
  ) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function readLocalEnvValue(key: string) {
  const processValue = process.env[key]?.trim();

  if (processValue) {
    return processValue;
  }

  const envFilePath = path.resolve(process.cwd(), ".env.local");

  if (!fs.existsSync(envFilePath)) {
    return undefined;
  }

  const line = fs
    .readFileSync(envFilePath, "utf8")
    .split(/\r?\n/)
    .find((value) => value.trimStart().startsWith(`${key}=`));

  if (!line) {
    return undefined;
  }

  const value = line.slice(line.indexOf("=") + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
