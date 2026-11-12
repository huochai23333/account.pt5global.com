import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { repositoryRoots, webRoot } from "./learning/catalogue.mjs";
import { isDeclaredLocalApi, readDeclaredApiPort } from "./learning/local-api-config.mjs";
import { inspectWindowsApiPort } from "./learning/windows-port-exclusions.mjs";
import {
  chooseNpmVersion,
  describeConfiguration,
  isLocalJobEndpoint,
  parseEnvironment,
  hasKnownGatewayReuseRisk,
  isDeclaredLocalAuthUrl,
  isDeclaredLocalAuthCallbackUrl,
} from "./learning/doctor-checks.mjs";

const checks = [];
function record(name, status, message) {
  checks.push({ name, status, message });
}
function runLocal(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    // 子进程错误可能包含环境或连接参数，诊断只报告固定提示。
    return null;
  }
}
async function checkHttp(name, url, headers = {}) {
  try {
    const response = await fetch(url, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(name === "Web" ? 15000 : 3000),
    });
    record(
      name,
      response.ok ? "ok" : "error",
      response.ok ? "本地服务已响应。" : "本地服务未就绪，请检查对应服务。 ",
    );
    await response.body?.cancel();
  } catch {
    record(name, "error", "无法连接本地服务，请按启动手册检查。");
  }
}

/** 不启动服务、不写文件、不修复数据；所有可能联网的探测只允许回环地址。 */
async function main() {
  const packageJson = JSON.parse(readFileSync(path.join(webRoot, "package.json"), "utf8"));
  record(
    "Node.js",
    Number(process.versions.node.split(".")[0]) === 24 ? "ok" : "error",
    `当前 ${process.versions.node}，本项目当前验证使用 Node.js 24。`,
  );
  const expectedNpm = packageJson.packageManager.replace("npm@", "");
  let invokedVersion;
  if (process.env.npm_execpath) {
    try {
      const npmPackage = JSON.parse(
        readFileSync(
          path.resolve(path.dirname(process.env.npm_execpath), "../package.json"),
          "utf8",
        ),
      );
      if (npmPackage.name === "npm") invokedVersion = npmPackage.version;
    } catch {
      /* 无法确认执行包时，仅使用继承的版本提示，不打印执行路径。 */
    }
  }
  const actualNpm = chooseNpmVersion(invokedVersion, process.env.npm_config_user_agent);
  record(
    "npm",
    actualNpm === expectedNpm ? "ok" : "warning",
    `当前 ${actualNpm ?? "未确认"}，项目声明 ${expectedNpm}；安装与验证使用同一版本。`,
  );
  record(
    "依赖",
    existsSync(path.join(webRoot, "node_modules/next/package.json")) ? "ok" : "error",
    "依赖缺失时先在 Web 仓库运行 npm ci。",
  );
  record(
    "后端仓库",
    existsSync(path.join(repositoryRoots.supabase, "supabase/config.toml")) ? "ok" : "error",
    "后端应位于 Web 仓库同级的 PT5-dropshipping-supabase。",
  );

  const envFile = path.join(webRoot, ".env.local");
  const environment = existsSync(envFile) ? parseEnvironment(readFileSync(envFile, "utf8")) : {};
  for (const config of describeConfiguration(environment)) {
    record(
      config.name,
      config.present ? "ok" : "error",
      config.present ? "已配置。" : "尚未配置，请在本机设置，勿粘贴到报告。",
    );
  }
  record(
    "本地管理员能力",
    environment.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "warning",
    environment.SUPABASE_SERVICE_ROLE_KEY
      ? "已配置；仍须从页面验证账号管理。"
      : "未配置；账号管理及独立管理验证可能不可用。",
  );

  const databaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL;
  const backendConfigFile = path.join(repositoryRoots.supabase, "supabase/config.toml");
  const backendConfig = existsSync(backendConfigFile)
    ? readFileSync(backendConfigFile, "utf8")
    : "";
  const apiPort = readDeclaredApiPort(backendConfig);
  const windowsPort = inspectWindowsApiPort(apiPort);
  record("Windows API 端口", windowsPort.status, windowsPort.message);
  const matchesProject = isDeclaredLocalApi(databaseUrl, apiPort);
  record(
    "本地项目地址",
    matchesProject ? "ok" : "error",
    matchesProject
      ? "Web 配置端口与同级后端 API 配置一致。"
      : "Web 配置与后端 API 端口不一致或不是本地地址，先核对项目。",
  );
  if (matchesProject) {
    const headers = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ? { apikey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }
      : {};
    await checkHttp("Auth", new URL("/auth/v1/health", databaseUrl), headers);
    await checkHttp("Storage", new URL("/storage/v1/status", databaseUrl), headers);
  } else {
    record("测试连接范围", "error", "当前配置不是本地 HTTP 回环地址；已跳过所有后台请求。");
  }
  await checkHttp("Web", "http://localhost:3000/login");

  const dockerVersion = runLocal("docker", ["version", "--format", "{{.Server.Version}}"]);
  record(
    "Docker",
    dockerVersion ? "ok" : "error",
    dockerVersion ? "引擎可连接。" : "请启动 Docker Desktop 并等待引擎就绪。",
  );
  if (dockerVersion) {
    for (const service of ["db", "auth", "rest", "storage", "kong", "vector"]) {
      const state = runLocal("docker", [
        "inspect",
        "--format",
        "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}",
        `supabase_${service}_pt5-dropshipping`,
      ]);
      const ready =
        state?.startsWith("running|") &&
        !state.endsWith("unhealthy") &&
        !state.endsWith("starting");
      record(
        `Docker ${service}`,
        ready ? "ok" : service === "vector" ? "warning" : "error",
        ready ? "运行正常。" : "容器未就绪；日志采集问题见环境排查手册。",
      );
    }
    // 这里只读取指定的非密钥配置，不把完整Auth环境或SMTP凭据带进诊断输出。
    const authExternal = runLocal("docker", ["inspect", "--format",
      '{{range .Config.Env}}{{if eq (index (split . "=") 0) "API_EXTERNAL_URL"}}{{.}}{{end}}{{end}}',
      "supabase_auth_pt5-dropshipping"]);
    const authUrlMatches = isDeclaredLocalAuthUrl(authExternal?.replace(/^API_EXTERNAL_URL=/, ""), apiPort);
    record("Auth邮件与回调地址", authUrlMatches ? "ok" : "error", authUrlMatches
      ? "Auth外部地址与项目声明的本机API端口一致。"
      : "Auth生成链接的地址尚未与本机API端口一致；核对本项目Auth容器，勿修改生产站点地址。");
    const mailerPaths = runLocal("docker", ["inspect", "--format",
      '{{range .Config.Env}}{{if or (eq (index (split . "=") 0) "GOTRUE_MAILER_URLPATHS_INVITE") (eq (index (split . "=") 0) "GOTRUE_MAILER_URLPATHS_RECOVERY") (eq (index (split . "=") 0) "GOTRUE_MAILER_URLPATHS_CONFIRMATION") (eq (index (split . "=") 0) "GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE")}}{{println .}}{{end}}{{end}}',
      "supabase_auth_pt5-dropshipping"]);
    const mailerUrls = parseEnvironment(mailerPaths ?? "");
    const mailersMatch = ["INVITE", "RECOVERY", "CONFIRMATION", "EMAIL_CHANGE"]
      .every(kind => isDeclaredLocalAuthCallbackUrl(mailerUrls[`GOTRUE_MAILER_URLPATHS_${kind}`], apiPort));
    record("Auth邮件验证路径", mailersMatch ? "ok" : "error", mailersMatch
      ? "四类邮件验证地址均指向本项目本机API。"
      : "邮件专用验证地址可能仍覆盖为旧端口；请分别核对本项目Auth的四项邮件路径配置。");
    const recoveryFile = path.join(repositoryRoots.supabase, "templates/auth/recovery.html");
    const templateSetting = runLocal("docker", ["inspect", "--format",
      '{{range .Config.Env}}{{if eq (index (split . "=") 0) "GOTRUE_MAILER_TEMPLATES_RECOVERY"}}{{.}}{{end}}{{end}}',
      "supabase_auth_pt5-dropshipping"]);
    const templateUrl = "http://supabase_kong_pt5-dropshipping:8088/email/recovery.html";
    const expectedTemplate = templateSetting === `GOTRUE_MAILER_TEMPLATES_RECOVERY=${templateUrl}`;
    // 只读取固定的本项目内部模板地址，绝不根据容器环境访问任意第三方URL。
    const servedTemplate = expectedTemplate ? runLocal("docker", ["exec", "supabase_db_pt5-dropshipping",
      "curl", "--silent", "--show-error", "--fail", "--max-time", "3", templateUrl]) : null;
    const digest = value => createHash("sha256").update(value).digest("hex");
    const templateMatches = servedTemplate !== null && existsSync(recoveryFile) &&
      digest(servedTemplate) === digest(readFileSync(recoveryFile, "utf8").trim());
    record("Auth恢复邮件模板", templateMatches ? "ok" : "error", templateMatches
      ? "Auth已加载本机恢复模板，实际服务内容与仓库一致。"
      : "本机恢复模板未加载或内容不一致；请按环境手册检查Auth模板配置和网关8088服务。");
    const restVersion = runLocal("docker", ["exec", "supabase_rest_pt5-dropshipping", "postgrest", "--version"]);
    const gatewayPool = runLocal("docker", ["exec", "supabase_kong_pt5-dropshipping", "sh", "-c",
      "sed -n 's/^upstream_keepalive_pool_size = //p' /usr/local/kong/.kong_env"]);
    // Kong 热重载后的修复会在 CLI 重建时丢失；只读诊断必须能重新发现旧版风险。
    const gatewayRisk = hasKnownGatewayReuseRisk(restVersion, gatewayPool);
    record("网关连接复用", gatewayRisk ? "error" : restVersion && gatewayPool ? "ok" : "warning", gatewayRisk
      ? "旧版本存在已复现的间歇请求失败；按环境手册预览本项目 repair-local-gateway，不重试业务写入。"
      : restVersion && gatewayPool ? "配置已读取，未命中当前已确认的旧版风险；这不代替请求与页面验证。" : "未确认版本或连接配置，请按环境手册核对。");
    const query =
      "select (select count(*) from cron.job where active)::text || '|' || (select count(*) from net.http_request_queue)::text";
    const isolation = runLocal("docker", [
      "exec",
      "-e",
      "PGPASSWORD=postgres",
      "supabase_db_pt5-dropshipping",
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-At",
      "-c",
      query,
    ]);
    record(
      "后台任务隔离",
      isolation === "0|0" ? "ok" : "warning",
      isolation === "0|0"
        ? "计划任务已暂停，外部请求队列为空；这仍不替代夹具隔离检查。"
        : "计划任务或外部请求队列尚未确认安全，写入测试前先处理。",
    );
    const migrationDirectory = path.join(repositoryRoots.supabase, "supabase/migrations");
    const jobJson = runLocal("docker", ["exec", "-e", "PGPASSWORD=postgres", "supabase_db_pt5-dropshipping",
      "psql", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", "postgres", "-qAt", "-c",
      "select coalesce(json_agg(endpoint),'[]') from public.internal_job_request_secrets"]);
    const jobEndpoints = jobJson ? JSON.parse(jobJson) : null;
    const safeJobs = Array.isArray(jobEndpoints) && jobEndpoints.length > 0 && jobEndpoints.every(endpoint => isLocalJobEndpoint(endpoint, apiPort));
    record("后台任务调用地址", safeJobs ? "ok" : "error", safeJobs
      ? "已登记任务均指向本项目本地函数；仍需限制函数内的第三方出口。"
      : "任务地址含远端或尚未确认；暂停计划任务不能阻止手动触发，请先按环境手册修复。");
    const expectedVersions = existsSync(migrationDirectory)
      ? readdirSync(migrationDirectory)
          .filter((file) => file.endsWith(".sql"))
          .map((file) => file.split("_")[0])
          .sort()
      : [];
    const versions = runLocal("docker", [
      "exec",
      "-e",
      "PGPASSWORD=postgres",
      "supabase_db_pt5-dropshipping",
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-qAt",
      "-c",
      "select version from supabase_migrations.schema_migrations order by version",
    ]);
    const actualVersions = versions ? versions.split(/\r?\n/).sort() : [];
    const matches =
      expectedVersions.length > 0 &&
      JSON.stringify(expectedVersions) === JSON.stringify(actualVersions);
    record(
      "迁移版本集合",
      matches ? "ok" : "error",
      matches
        ? `本地与仓库 ${expectedVersions.length} 个迁移版本完全一致。`
        : "本地与仓库迁移集合不一致；请比较具体版本，勿直接 reset 或仅修改数量。",
    );
  }
  const result = {
    kind: "read_only_environment_diagnosis",
    checks,
    errors: checks.filter((check) => check.status === "error").length,
  };
  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else for (const check of checks) console.log(`[${check.status}] ${check.name}：${check.message}`);
  process.exitCode = result.errors ? 1 : 0;
}

await main();
