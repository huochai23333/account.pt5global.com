import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { runLocalSupabaseSql } from "./local-supabase";

type ContainerInfo = {
  labels: Record<string, string>;
  running: boolean;
  networks: Record<string, { NetworkID: string }>;
};
type EdgePorts = {
  root: string;
  owner: string;
  mode: string;
  project: string;
  container: string;
  info: (name: string) => ContainerInfo;
  docker: (args: string[]) => string;
  guard: () => void;
  sql: (statement: string) => string;
};

/** 同级后端提供真实挂载核验；这里只接类型边界，不复制其实现或加载原认证助手。 */
export function requireBocSuiteBoundary() {
  runLocalSupabaseSql("select 1;");
  const project = process.env.PT5_E2E_DATABASE_PROJECT!,
    container = process.env.PT5_E2E_DATABASE_CONTAINER!;
  const owner = process.env.PT5_E2E_RATE_OWNER;
  assert(
    owner && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(owner),
    "boc_suite_mock_owner_missing",
  );
  assert(
    (process.env.PT5_E2E_PROVIDER_MODE ?? "mock") === "mock",
    "boc_suite_requires_local_mock",
  );
  const workdir = process.env.PT5_E2E_WORKDIR;
  assert(workdir && path.isAbsolute(workdir), "boc_suite_workdir_missing");
  const root = fs.realpathSync(workdir);
  const config = fs.readFileSync(
    path.join(root, "supabase/config.toml"),
    "utf8",
  );
  const actualProject = config
    .split(/^\s*\[/m)[0]
    .match(/^\s*project_id\s*=\s*"([^"]+)"/m)?.[1];
  assert(actualProject === project, "boc_suite_workdir_project_mismatch");
  // 受信任的同级MJS只导出纯核验，不执行CLI、读种子或创建另一套登录。
  const backend = path.resolve(
    __dirname,
    "../../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-edge.mjs",
  );
  const { verifyRateSyncEdge } = createRequire(__filename)(backend) as {
    verifyRateSyncEdge: (ports: EdgePorts) => {
      verifiedFiles: number;
      mode: string;
      project: string;
    };
  };
  const docker = (args: string[]) => {
    try {
      return execFileSync("docker", args, {
        encoding: "utf8",
        timeout: 12_000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch {
      throw new Error("boc_suite_container_read_unconfirmed");
    }
  };
  const info = (name: string): ContainerInfo => {
    try {
      return JSON.parse(
        docker([
          "inspect",
          "--format",
          '{"labels":{{json .Config.Labels}},"running":{{json .State.Running}},"networks":{{json .NetworkSettings.Networks}}}',
          name,
        ]),
      );
    } catch {
      throw new Error("boc_suite_container_metadata_invalid");
    }
  };
  const edge = verifyRateSyncEdge({
    root,
    owner,
    mode: "mock",
    project,
    container,
    info,
    docker,
    guard: () => {
      runLocalSupabaseSql("select 1;");
    },
    sql: runLocalSupabaseSql,
  });
  const today = runLocalSupabaseSql(
    "select public.current_exchange_rate_date()::text;",
  );
  return { owner, today, edge, project, providerMode: "local_mock" as const };
}

/** SDK必须与已声明专属网关完全一致；验证前不得发出独立管理员查询或写入。 */
export function assertBocSdkOrigin(client: unknown) {
  const value =
    client && typeof client === "object"
      ? Reflect.get(client, "supabaseUrl")
      : undefined;
  let matches = false;
  try {
    matches =
      typeof value === "string" &&
      new URL(value).href ===
        new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").href;
  } catch {
    /* 错误只报边界名，不输出地址里的配置。 */
  }
  assert(matches, "boc_suite_sdk_origin_mismatch");
}
