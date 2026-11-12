import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual as same } from "node:util";
import type { AiAssistantSettlementReleaseAction } from "../../lib/ai-assistant/assistant-types";
import { requireRepairGraph } from "./settlement-repair-receipts";
import {
  emptyRepairGraph,
  prepareEmptySettlementGraphSql,
  readRepairGraphSql,
  removeRepairGraphSql,
  repairKeys,
  repairUuid,
  type RepairGraph,
} from "./settlement-repair-sql";

type Mode = "publication" | "parser" | "aliases";
type Publication = "formal" | "temporary";
type CustomerIndex = 0 | 1;
type Intent =
  Publication | `create:${CustomerIndex}` | `delete:${CustomerIndex}`;
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const quotaSql = `select jsonb_build_object('count',count(*),
  'fingerprint',md5(coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('_xmin',q.xmin::text) order by q.id),'[]')::text))
  from private.api_request_quota_events q where kind='ai';`;

/** 结汇指令的业务图、客户档案、任务和配额均从专属 SQL 独立核对。 */
export function createAssistantSettlementCase(
  execute: (sql: string) => string,
  mode: Mode,
) {
  const context = JSON.parse(
    execute(`select jsonb_build_object('date',public.current_exchange_rate_date(),
    'roles',(select coalesce(jsonb_agg(distinct jsonb_build_object('role',r.role,'id',p.user_id)),'[]')
      from public.user_profiles p join public.user_roles_data d on d.user_id=p.user_id
      join public.user_roles r on r.id=d.role_id
      where r.role in ('administrator','finance','salesman') and p.status='active')); `),
  ) as {
    date: string;
    roles: { role: string; id: string }[];
  };
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(context.date),
    "assistant_settlement_fixture_date",
  );
  const role = (name: string) => {
    const matches = context.roles.filter((item) => item.role === name);
    assert(
      matches.length === 1 && repairUuid.test(matches[0].id),
      "assistant_settlement_fixture_roles",
    );
    return matches[0].id;
  };
  const administrator = role("administrator"),
    finance = role("finance"),
    salesman = role("salesman");
  assert(
    new Set([administrator, finance, salesman]).size === 3,
    "assistant_settlement_fixture_roles",
  );
  const token = randomUUID();
  const data = {
    administrator,
    finance,
    salesman,
    date: context.date,
    formalCustomerId: randomUUID(),
    formalCustomerName: "Wholesale Alpha",
    formalAlias: "Alpha Shop",
    formalNote: `助手正式客户 ${token}`,
    temporaryNote: `助手临时客户 ${token}`,
    cancelledNote: `助手取消临时客户 ${token}`,
    temporaryCustomer: `Voltria-${token}`,
    sharedAlias: `共同别名 ${token}`,
    customerNames: [`重名客户甲 ${token}`, `重名客户乙 ${token}`] as const,
  };
  const read = () =>
    requireRepairGraph(JSON.parse(execute(readRepairGraphSql)));
  const quota = () =>
    JSON.parse(execute(quotaSql)) as { count: number; fingerprint: string };
  let expected: RepairGraph | undefined,
    quotaBefore: ReturnType<typeof quota> | undefined;
  let intent: Intent | undefined,
    prepared = false,
    cleanupAttempted = false,
    cleaned = false;
  const publications = new Map<
    Publication,
    { id: string; requestId: string }
  >();
  const aliases = new Map<
    CustomerIndex,
    { customer: string; archive: string; folder: string }
  >();

  const snapshot = () => {
    assert(
      expected && !cleanupAttempted && !cleaned,
      "assistant_settlement_no_confirmed_snapshot",
    );
    assert(same(quota(), quotaBefore), "assistant_settlement_quota_changed");
    return expected;
  };
  function customerScope(
    graph: RepairGraph,
    id: string,
    name: string,
    alias: string,
  ) {
    const customer = graph.customers.find((row) => row.id === id);
    const archives = graph.archives.filter((row) => row.customer_id === id);
    const folders = graph.folders.filter(
      (row) => row.archive_id === archives[0]?.id,
    );
    assert(
      customer?.unique_name === name &&
        customer.created_by_user_id === administrator &&
        customer.customer_kind === "sales_created" &&
        customer.registered_user_id === null &&
        same(customer.other_names, [alias]) &&
        customer.edit_revision === 1 &&
        archives.length === 1 &&
        archives[0].user_id === null &&
        archives[0].kind === "customer" &&
        folders.length === 1 &&
        folders[0].parent_id === null &&
        folders[0].system_key === "personal",
      "assistant_settlement_customer_receipt",
    );
    return {
      customer: id,
      archive: String(archives[0].id),
      folder: String(folders[0].id),
    };
  }
  function withoutCustomer(
    graph: RepairGraph,
    ids: { customer: string; archive: string; folder: string },
  ) {
    return {
      ...graph,
      customers: graph.customers.filter((row) => row.id !== ids.customer),
      archives: graph.archives.filter((row) => row.id !== ids.archive),
      folders: graph.folders.filter((row) => row.id !== ids.folder),
    };
  }
  function capture(
    action: Intent,
    check: (before: RepairGraph, after: RepairGraph) => void,
  ) {
    assert(intent === action, "assistant_settlement_action_unrecorded");
    const before = snapshot(),
      after = read();
    check(before, after);
    expected = after;
    intent = undefined;
  }
  return {
    data,
    prepare() {
      assert(
        !prepared && same(read(), emptyRepairGraph()),
        "assistant_settlement_scope_occupied",
      );
      quotaBefore = quota();
      assert(
        quotaBefore.count === 0 &&
          /^[a-f0-9]{32}$/.test(quotaBefore.fingerprint),
        "assistant_settlement_quota_occupied",
      );
      prepared = true;
      // 正式客户与别名只在两个相关场景准备。歧义场景仍由原页面创建客户。
      const statement =
        mode === "aliases"
          ? ""
          : `insert into public.wholesale_customers(id,unique_name,other_names,created_by_user_id,salesman_commission_cohort)
          values(${literal(data.formalCustomerId)},${literal(data.formalCustomerName)},array[${literal(data.formalAlias)}],
            ${literal(administrator)},'new');`;
      const graph = requireRepairGraph(
        JSON.parse(execute(prepareEmptySettlementGraphSql(statement))),
      );
      const remainder =
        mode === "aliases"
          ? graph
          : withoutCustomer(
              graph,
              customerScope(
                graph,
                data.formalCustomerId,
                data.formalCustomerName,
                data.formalAlias,
              ),
            );
      assert(
        same(remainder, emptyRepairGraph()) && same(read(), graph),
        "assistant_settlement_prepare_readback",
      );
      expected = graph;
    },
    begin(action: Intent) {
      snapshot();
      assert(
        !intent &&
          ((mode === "publication" &&
            (action === "formal" || action === "temporary")) ||
            (mode === "aliases" &&
              (action.startsWith("create:") || action.startsWith("delete:")))),
        "assistant_settlement_action_invalid",
      );
      intent = action;
    },
    published(
      name: Publication,
      id: string,
      action: AiAssistantSettlementReleaseAction,
    ) {
      assert(
        repairUuid.test(id) &&
          repairUuid.test(action.requestId) &&
          !publications.has(name) &&
          ![...publications.values()].some(
            (value) => value.id === id || value.requestId === action.requestId,
          ),
        "assistant_settlement_release_identity",
      );
      const isFormal = name === "formal";
      const note = isFormal ? data.formalNote : data.temporaryNote;
      const customerId = isFormal ? data.formalCustomerId : null;
      const customerName = isFormal
        ? data.formalCustomerName
        : data.temporaryCustomer;
      const amount = isFormal ? 12.34 : 708.27;
      assert(
        action.note === note &&
          action.customerId === customerId &&
          action.customerName === customerName &&
          action.customerKind === (isFormal ? "existing" : "temporary") &&
          action.amount === amount &&
          action.currency === "USD" &&
          action.receivedOn === data.date,
        "assistant_settlement_confirm_input",
      );
      capture(name, (before, graph) => {
        const row = graph.releases.find((value) => value.id === id);
        assert(
          row?.publication_request_id === action.requestId &&
            row.published_by_user_id === finance &&
            row.release_amount === amount &&
            row.release_currency === "USD" &&
            row.received_on === data.date &&
            row.customer_id === customerId &&
            row.customer_name === customerName &&
            row.note === note &&
            row.status === "pending" &&
            row.allocation_revision === 0 &&
            row.allocation_customer_id === null &&
            same(
              {
                ...graph,
                releases: graph.releases.filter((value) => value.id !== id),
              },
              before,
            ),
          "assistant_settlement_release_receipt",
        );
      });
      publications.set(name, { id, requestId: action.requestId });
    },
    created(index: CustomerIndex, id: string) {
      assert(
        repairUuid.test(id) && !aliases.has(index),
        "assistant_settlement_customer_identity",
      );
      capture(`create:${index}`, (before, graph) => {
        const scope = customerScope(
          graph,
          id,
          data.customerNames[index],
          data.sharedAlias,
        );
        assert(
          same(withoutCustomer(graph, scope), before),
          "assistant_settlement_customer_creation_scope",
        );
        aliases.set(index, scope);
      });
    },
    deleted(index: CustomerIndex) {
      const scope = aliases.get(index);
      assert(scope, "assistant_settlement_customer_not_registered");
      capture(`delete:${index}`, (before, graph) => {
        // 原删除接口只返回 void，独立确认客户、档案和根目录确实全部消失。
        assert(
          same(graph, withoutCustomer(before, scope)),
          "assistant_settlement_customer_delete_readback",
        );
      });
      aliases.delete(index);
    },
    unchanged() {
      const before = snapshot();
      assert(same(read(), before), "assistant_settlement_versions_changed");
    },
    cleanup() {
      if (!prepared || cleaned) return;
      const before = snapshot();
      assert(
        !intent && same(read(), before),
        "assistant_settlement_cleanup_unconfirmed",
      );
      cleanupAttempted = true;
      const receipt = JSON.parse(execute(removeRepairGraphSql(before)));
      assert(
        same(
          receipt,
          Object.fromEntries(
            repairKeys.map((key) => [key, before[key].length]),
          ),
        ),
        "assistant_settlement_cleanup_counts",
      );
      assert(
        same(read(), emptyRepairGraph()) && same(quota(), quotaBefore),
        "assistant_settlement_cleanup_readback",
      );
      cleaned = true;
      return receipt;
    },
    evidence() {
      return {
        mode,
        intent,
        cleaned,
        cleanupAttempted,
        publications: Object.fromEntries(publications),
        customers: Object.fromEntries(aliases),
        quota: quotaBefore,
        rows: expected
          ? Object.fromEntries(
              repairKeys.map((key) => [
                key,
                expected![key].map((row) => ({
                  id: row.id,
                  version: row._xmin,
                  status: row.status,
                })),
              ]),
            )
          : null,
        fingerprint: expected
          ? createHash("sha256").update(JSON.stringify(expected)).digest("hex")
          : null,
      };
    },
  };
}
