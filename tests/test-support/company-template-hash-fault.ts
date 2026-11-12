import { createHash } from "node:crypto";

type Row = { record: Record<string, unknown>; version: string };
type Graph = { template: Row; version: Row };
type Input = {
  templateId: string;
  versionId: string;
  originalHash: string;
  apiOrigin: string;
  sdkOrigin: string;
};
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const snapshot = (alias: string) =>
  `jsonb_build_object('record',to_jsonb(${alias}),'version',${alias}.xmin::text)`;

/** 仅接受原客户端的来源和专属SQL能力。故障只改一个已核对版本，恢复不是按旧哈希盲写。 */
export function createCompanyTemplateHashFault(
  execute: (sql: string) => string,
  input: Input,
) {
  if (
    !uuid.test(input.templateId) ||
    !uuid.test(input.versionId) ||
    !/^[a-f0-9]{64}$/.test(input.originalHash) ||
    input.originalHash === "0".repeat(64)
  )
    throw new Error("template_hash_fault_identity_invalid");
  let api: URL, sdk: URL;
  try {
    api = new URL(input.apiOrigin);
    sdk = new URL(input.sdkOrigin);
  } catch {
    throw new Error("template_hash_fault_origin_invalid");
  }
  if (
    api.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(api.hostname) ||
    api.username ||
    api.password ||
    api.origin !== sdk.origin
  )
    throw new Error("template_hash_fault_origin_mismatch");
  const expression = `jsonb_build_object('template',${snapshot("t")},'version',${snapshot("v")})`;
  const from = `from public.company_templates t join public.company_template_versions v on v.template_id=t.id
    where t.id='${input.templateId}'::uuid and v.id='${input.versionId}'::uuid`;
  const read = (): Graph =>
    JSON.parse(execute(`select ${expression} ${from};`));
  let original: Graph | undefined,
    injected: Graph | undefined,
    restored: Graph | undefined;
  let attempted = false;
  function identity(graph: Graph) {
    if (
      !graph?.template?.record ||
      !graph?.version?.record ||
      graph.template.record.id !== input.templateId ||
      graph.version.record.id !== input.versionId ||
      graph.version.record.template_id !== input.templateId ||
      graph.template.record.current_version_id !== input.versionId ||
      typeof graph.template.version !== "string" ||
      typeof graph.version.version !== "string" ||
      !/^\d+$/.test(graph.template.version) ||
      !/^\d+$/.test(graph.version.version)
    )
      throw new Error("template_hash_fault_graph_invalid");
  }
  function transition(expected: Graph, hash: string) {
    // 准备和恢复都在短事务锁内再次比较整图；0影响触发异常并回滚，不能凭无error认为已改好。
    const result: { changed: number; graph: Graph } = JSON.parse(
      execute(`begin;
      lock table public.company_templates,public.company_template_versions in share row exclusive mode;
      do $$ declare actual jsonb; changed integer; begin
        select ${expression} into actual ${from};
        if actual is distinct from ${quote(JSON.stringify(expected))}::jsonb then raise exception 'template_hash_fault_version_changed'; end if;
        update public.company_template_versions set html_sha256=${quote(hash)}
          where id='${input.versionId}' and template_id='${input.templateId}' and xmin::text=${quote(expected.version.version)};
        get diagnostics changed=row_count;
        if changed<>1 then raise exception 'template_hash_fault_zero_affected'; end if;
      end $$;
      select jsonb_build_object('changed',1,'graph',${expression}) ${from}; commit;`),
    );
    if (result.changed !== 1)
      throw new Error("template_hash_fault_receipt_invalid");
    identity(result.graph);
    if (
      !same(result.graph.template, expected.template) ||
      result.graph.version.version === expected.version.version ||
      !same(result.graph.version.record, {
        ...expected.version.record,
        html_sha256: hash,
      })
    )
      throw new Error("template_hash_fault_transition_invalid");
    return result.graph;
  }
  return {
    arm() {
      if (attempted) throw new Error("template_hash_fault_already_attempted");
      const graph = read();
      identity(graph);
      if (
        graph.version.record.html_sha256 !== input.originalHash ||
        typeof graph.version.record.html_content !== "string" ||
        createHash("sha256")
          .update(graph.version.record.html_content)
          .digest("hex") !== input.originalHash
      )
        throw new Error("template_hash_fault_original_digest_invalid");
      original = graph;
      attempted = true;
      injected = transition(graph, "0".repeat(64));
      if (!same(read(), injected))
        throw new Error("template_hash_fault_injection_not_final");
      return structuredClone(injected);
    },
    verify() {
      if (!injected || restored || !same(read(), injected))
        throw new Error("template_hash_fault_not_active");
      return structuredClone(injected);
    },
    restore() {
      if (!attempted) return { restored: false, inactive: true };
      if (restored) return { restored: true, repeated: true };
      // 提交可能已发生但凭证丢失时，绝不把当前图采为新期望，保留专属实例供独立核对。
      if (!original || !injected)
        throw new Error("template_hash_fault_outcome_unknown");
      const candidate = transition(injected, input.originalHash);
      if (
        !same(candidate.version.record, original.version.record) ||
        !same(read(), candidate)
      )
        throw new Error("template_hash_fault_restore_not_final");
      restored = candidate;
      return {
        restored: true,
        id: input.versionId,
        version: restored.version.version,
        changed: 1,
      };
    },
    evidence() {
      return structuredClone({ attempted, original, injected, restored });
    },
  };
}
