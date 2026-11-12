import assert from "node:assert/strict";
import { execFile } from "node:child_process";

const mailBase = "http://supabase_inbucket_pt5-dropshipping:8025";
function docker(args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "docker",
      args,
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 20000,
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout) =>
        error
          ? reject(new Error("本项目邮件或数据库观测失败"))
          : resolve(stdout.trim()),
    );
    if (input !== undefined) {
      child.stdin.on("error", reject);
      child.stdin.end(input);
    }
  });
}

async function sql(statement) {
  return JSON.parse(
    await docker(
      [
        "exec",
        "-i",
        "supabase_db_pt5-dropshipping",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-XqAtw",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      statement,
    ),
  );
}

function requireOwnActor(actor) {
  assert(/^[a-f0-9-]{36}$/.test(actor.id));
  assert(/^learning-[a-f0-9-]{36}@example\.invalid$/.test(actor.email));
}

/** 测试只能投递到本项目Mailpit，禁止使用共享供应商、外部转发或整箱清理。 */
export async function requireLocalAuthMailbox() {
  const inspect = async (name) =>
    JSON.parse(await docker(["inspect", name]))[0];
  const auth = await inspect("supabase_auth_pt5-dropshipping");
  const mail = await inspect("supabase_inbucket_pt5-dropshipping");
  for (const container of [auth, mail]) {
    assert.equal(
      container.Config.Labels["com.supabase.cli.project"],
      "pt5-dropshipping",
    );
    assert(container.State.Running);
  }
  const environment = (rows) =>
    Object.fromEntries(
      rows.map((row) => {
        const i = row.indexOf("=");
        return [row.slice(0, i), row.slice(i + 1)];
      }),
    );
  const authEnv = environment(auth.Config.Env),
    mailEnv = environment(mail.Config.Env);
  assert.equal(authEnv.GOTRUE_SMTP_HOST, "supabase_inbucket_pt5-dropshipping");
  assert.equal(
    authEnv.GOTRUE_MAILER_TEMPLATES_RECOVERY,
    "http://supabase_kong_pt5-dropshipping:8088/email/recovery.html",
  );
  assert(
    !Object.entries(mailEnv).some(
      ([key, value]) =>
        /FORWARD|RELAY/.test(key) && value && !["false", "0"].includes(value),
    ),
  );
  return {
    localOnly: true,
    messages: (await mailApi("/api/v1/info")).Messages,
  };
}

async function mailApi(path, body) {
  assert(path.startsWith("/api/v1/"));
  const args = [
    "exec",
    "supabase_db_pt5-dropshipping",
    "curl",
    "--noproxy",
    "*",
    "--silent",
    "--show-error",
    "--fail",
    "--max-time",
    "10",
  ];
  if (body) {
    assert.equal(path, "/api/v1/messages");
    assert(body.IDs.length > 0);
    args.push("--request", "DELETE", "--json", JSON.stringify(body));
  }
  const result = await docker([...args, mailBase + path]);
  return result.startsWith("{") ? JSON.parse(result) : result;
}

export async function ownRecoveryMessages(actor) {
  requireOwnActor(actor);
  const result = await mailApi(
    "/api/v1/search?query=" +
      encodeURIComponent("to:" + actor.email) +
      "&limit=100",
  );
  assert(Array.isArray(result.messages));
  assert(
    result.messages.every((message) =>
      message.To.some((to) => to.Address === actor.email),
    ),
  );
  return result.messages;
}

export async function readRecoveryMail(actor) {
  const messages = await ownRecoveryMessages(actor);
  assert.equal(messages.length, 1);
  const message = await mailApi("/api/v1/message/" + messages[0].ID);
  const links = [...message.HTML.matchAll(/https?:\/\/[^\s"<>]+/g)].map(
    (match) => new URL(match[0].replaceAll("&amp;", "&")),
  );
  const link = links.find(
    (url) =>
      url.pathname === "/auth/confirm" &&
      url.searchParams.get("type") === "recovery",
  );
  assert(
    link &&
      link.origin === "http://localhost:3000" &&
      link.searchParams.get("token_hash"),
  );
  // 链接里的令牌只在内存用于实际打开页面；附件只保存本地邮件ID与无查询参数的入口。
  return {
    link: link.href,
    receipt: {
      messageId: message.ID,
      callbackOrigin: link.origin,
      callbackPath: link.pathname,
    },
  };
}

export async function cleanupRecoveryMail(actor) {
  const messages = await ownRecoveryMessages(actor),
    ids = messages.map((message) => message.ID);
  // Mailpit把空ID当作删除整箱，因此只能提交已核对收件人的非空列表。
  if (ids.length) await mailApi("/api/v1/messages", { IDs: ids });
  assert.equal((await ownRecoveryMessages(actor)).length, 0);
  return { removedMessageIds: ids, remainingOwnMessages: 0 };
}

/** 密码摘要仅用于测试内存比较，不写附件、不输出到日志。对外凭证保留编号与行版本。 */
export async function readAuthPasswordRecord(actor) {
  requireOwnActor(actor);
  return sql(
    `select jsonb_build_object('id',id,'fingerprint',md5(encrypted_password),'version',xmin::text,'updatedAt',updated_at,'recoverySentAt',recovery_sent_at)from auth.users where id='${actor.id}';`,
  );
}

export function publicAuthReceipt(record) {
  return {
    id: record.id,
    version: record.version,
    updatedAt: record.updatedAt,
    recoverySentAt: record.recoverySentAt,
  };
}

export async function captureAuthDatabaseState() {
  const tables = [
    "auth.users",
    "public.user_profiles",
    "public.user_roles_data",
    "public.wholesale_customers",
    "public.user_home_widget_layouts",
    "public.user_announcement_reads",
    "public.user_privacy_data",
    "public.user_profile_change_requests",
    "public.user_privacy_requests",
  ];
  const fields = tables.map(
    (table) =>
      `'${table}',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(row_to_json(t)::text||':'||t.xmin::text,E'\n' order by row_to_json(t)::text),'')))from ${table} t)`,
  );
  return sql(
    `select jsonb_build_object('tables',jsonb_build_object(${fields.join(",")}), 'tasks',jsonb_build_object('scheduler',current_setting('cron.launch_active_jobs'),'jobs',(select count(*)from cron.job where active),'queue',(select count(*)from net.http_request_queue),'runs',(select count(*)from private.operation_runs)));`,
  );
}

export async function requireOwnedAuthCleanup(ids) {
  assert(ids.length > 0 && ids.every((id) => /^[a-f0-9-]{36}$/.test(id)));
  const values = ids.map((id) => `'${id}'`).join(",");
  const result = await sql(
    `select jsonb_build_object('users',(select count(*)from auth.users where id in (${values})),'sessions',(select count(*)from auth.sessions where user_id in (${values})),'refreshTokens',(select count(*)from auth.refresh_tokens where user_id in (${values})),'announcementReads',(select count(*)from public.user_announcement_reads where user_id in (${values})));`,
  );
  assert(Object.values(result).every((value) => value === 0));
  return result;
}
