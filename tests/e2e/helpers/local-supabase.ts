import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LOCAL_SUPABASE_URL_PATTERN =
  /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/;

/** 只允许测试向本机 54321 端口对应的 Docker Supabase 执行准备和清理 SQL。 */
export function runLocalSupabaseSql(statement: string) {
  if (!isLocalSupabaseTestTarget()) {
    throw new Error(
      "This test requires the local Docker Supabase on port 54321.",
    );
  }

  // SQL 通过标准输入传给固定容器，不把测试内容拼进 shell 命令。
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_pt5-dropshipping",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    {
      input: statement,
      encoding: "utf8",
    },
  ).trim();
}

export function isLocalSupabaseTestTarget() {
  return LOCAL_SUPABASE_URL_PATTERN.test(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
      readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL") ??
      "",
  );
}

function readLocalEnvValue(key: string) {
  const envFilePath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envFilePath)) return undefined;

  const line = fs
    .readFileSync(envFilePath, "utf8")
    .split(/\r?\n/)
    .find((value) => value.startsWith(`${key}=`));

  return line?.slice(key.length + 1).trim();
}
