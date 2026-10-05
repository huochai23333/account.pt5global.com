type FixtureBoundary = {
  baseURL: string | undefined;
  supabaseURL: string | undefined;
  mode: string | undefined;
};

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
