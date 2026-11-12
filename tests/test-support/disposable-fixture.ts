export type FixtureBoundary = {
  baseURL: string | undefined;
  supabaseURL: string | undefined;
  mode: string | undefined;
};

type PostgresBoundary = FixtureBoundary & { project: string | undefined; container: string | undefined };

/** 会重置共享种子的用例必须显式声明专用夹具；此声明不能代替真实数据库隔离。 */
export function requireDisposableFixture({ baseURL, supabaseURL, mode }: FixtureBoundary) {
  if (mode !== "disposable") throw new Error("destructive E2E fixtures require PT5_E2E_FIXTURE_MODE=disposable and a dedicated fixture environment");
  for (const [name, value] of [["application", baseURL], ["Supabase", supabaseURL]] as const) {
    let url: URL;
    try { url = new URL(value ?? ""); } catch { throw new Error(`${name} fixture endpoint must be an explicit local URL`); }
    if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password) {
      throw new Error(`${name} fixture endpoint must be local and contain no credentials`);
    }
  }
}

export type DisposableContainerInfo = {
  labels: Record<string, string> | null;
  running: boolean;
  ports: Record<string, { HostIp: string; HostPort: string }[] | null> | null;
  networks: Record<string, { NetworkID?: string }> | null;
};

/** 整体锁/固定数据测试还须把API映射到同一专属项目；声明disposable不能单独证明容器归属。 */
export function requireDisposablePostgresTarget(
  boundary: PostgresBoundary,
  inspect: (name: string) => DisposableContainerInfo,
) {
  requireDisposableFixture(boundary);
  const { project, container } = boundary;
  if (!project || !container || project.length > 63 || !/^pt5-(?:e2e|learning)-[a-z0-9][a-z0-9_-]*$/.test(project)
    || container !== `supabase_db_${project}`) {
    throw new Error("document_lock_requires_dedicated_project");
  }
  const endpoint = new URL(boundary.supabaseURL!);
  if (endpoint.protocol !== "http:" || !endpoint.port || endpoint.pathname !== "/" || endpoint.search || endpoint.hash)
    throw new Error("document_lock_requires_explicit_api_origin");
  const database = inspect(container);
  const gateway = inspect(`supabase_kong_${project}`);
  for (const info of [database, gateway]) {
    if (!info.running || info.labels?.["com.supabase.cli.project"] !== project)
      throw new Error("document_lock_project_mismatch");
  }
  const bound = gateway.ports?.["8000/tcp"]?.some(binding =>
    binding.HostPort === endpoint.port && ["127.0.0.1", "0.0.0.0", "::", "::1", ""].includes(binding.HostIp));
  if (!bound) throw new Error("document_lock_api_port_mismatch");
  const networks = new Set(Object.values(database.networks ?? {}).map(network => network.NetworkID).filter(Boolean));
  if (!Object.values(gateway.networks ?? {}).some(network => network.NetworkID && networks.has(network.NetworkID)))
    throw new Error("document_lock_network_mismatch");
  return container;
}

/** 共用只读接线：取锁、故障SQL及全实例清理都先确认同一专属项目，不读取容器密钥。 */
export function readDisposablePostgresTarget(boundary: PostgresBoundary, run: (args: string[]) => string) {
  const container = requireDisposablePostgresTarget(boundary, name => JSON.parse(run([
    "inspect", "--type", "container", "--format",
    '{"labels":{{json .Config.Labels}},"running":{{json .State.Running}},"ports":{{json .NetworkSettings.Ports}},"networks":{{json .NetworkSettings.Networks}}}', name,
  ])) as DisposableContainerInfo);
  const paused = run(["exec", "-e", "PGOPTIONS=-c statement_timeout=5000", container,
    "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1", "-c",
    "select current_setting('cron.launch_active_jobs'),(select count(*) from cron.job where active),(select count(*) from net.http_request_queue);",
  ]).trim();
  if (paused !== "off|0|0") throw new Error("document_lock_requires_paused_scheduler_and_empty_queue");
  return container;
}
