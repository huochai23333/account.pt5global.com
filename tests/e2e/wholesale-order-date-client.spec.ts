import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getDefaultWholesaleLogisticsFilters,
  getWholesaleLogisticsPage,
} from "../../lib/wholesale-logistics-page";
import { normalizeWholesaleOrderAssessmentPayload } from "../../lib/wholesale-order-assessment-filters";
import { getWholesaleOrderPage } from "../../lib/wholesale-order-page";

// Freeze only this test process; expectations below are fixed Shanghai calendar dates.
const originalDate = Date;
const frozenTimestamp = originalDate.parse("2026-01-01T00:30:00+08:00");
test.beforeEach(() => {
  globalThis.Date = new Proxy(originalDate, {
    construct(target, args) { return Reflect.construct(target, args.length ? args : [frozenTimestamp]); },
    get(target, property) { return property === "now" ? () => frozenTimestamp : Reflect.get(target, property); },
  });
});
test.afterEach(() => { globalThis.Date = originalDate; });

test("wholesale order RPC receives normalized dates and explicit search mode", async () => {
  let rpcArguments: Record<string, unknown> | null = null;
  let rpcName = "";
  const supabase = {
    rpc: async (name: string, argumentsValue: Record<string, unknown>) => {
      rpcName = name;
      rpcArguments = argumentsValue;
      return {
        data: {
          canViewInternalFields: false,
          nextCursor: null,
          orders: [],
          summary: {},
          totalCount: 0,
        },
        error: null,
      };
    },
  } as unknown as SupabaseClient;

  await getWholesaleOrderPage(supabase, {
    customerId: "",
    orderMonth: "2026-09",
    orderedFromDate: "",
    orderedToDate: "invalid",
    salesUserId: "",
    searchMode: "exact_all_time",
    searchText: " WH-1001 ",
    status: "all",
  });

  expect(rpcName).toBe("get_wholesale_order_page");
  expect(rpcArguments).not.toBeNull();
  expect((rpcArguments as unknown as { p_filters: unknown }).p_filters).toMatchObject({
    orderedFromDate: "2025-12-03",
    orderedToDate: "2026-01-01",
    orderMonth: "2026-09",
    searchMode: "exact_all_time",
    searchText: "WH-1001",
  });
});

test("wholesale order assessment accepts the same included month", () => {
  const filters = normalizeWholesaleOrderAssessmentPayload({
    filters: {
      customerId: "",
      orderMonth: "2026-09",
      orderedFromDate: "2026-09-01",
      orderedToDate: "2026-09-30",
      salesUserId: "",
      searchText: "",
      status: "all",
    },
  });

  expect(filters.orderMonth).toBe("2026-09");
  expect(() =>
    normalizeWholesaleOrderAssessmentPayload({
      filters: { ...filters, orderMonth: "2026-13" },
    }),
  ).toThrow("invalid order month");
});

test("wholesale logistics defaults and RPC use the mandatory rolling range", async () => {
  const defaultRange = { fromDate: "2025-12-03", toDate: "2026-01-01" };
  const filters = getDefaultWholesaleLogisticsFilters(
    "salesman",
    "sales-user-id",
  );
  expect(filters).toMatchObject({
    fromDate: defaultRange.fromDate,
    salesUserId: "sales-user-id",
    searchMode: "date_range",
    toDate: defaultRange.toDate,
  });

  let rpcArguments: Record<string, unknown> | null = null;
  let rpcName = "";
  const supabase = {
    rpc: async (name: string, argumentsValue: Record<string, unknown>) => {
      rpcName = name;
      rpcArguments = argumentsValue;
      return {
        data: {
          lastUpdatedAt: null,
          missingCostCount: 0,
          nextCursor: null,
          recordedCostCount: 0,
          rows: [],
          totalCount: 0,
          totalsByCurrency: {},
        },
        error: null,
      };
    },
  } as unknown as SupabaseClient;

  await getWholesaleLogisticsPage(supabase, {
    ...filters,
    fromDate: "",
    searchMode: "exact_all_time",
    searchText: " PKG-1001 ",
  });

  expect(rpcName).toBe("get_wholesale_logistics_page");
  expect(rpcArguments).not.toBeNull();
  expect((rpcArguments as unknown as { p_filters: unknown }).p_filters).toMatchObject({
    fromDate: defaultRange.fromDate,
    searchMode: "exact_all_time",
    searchText: "PKG-1001",
    toDate: defaultRange.toDate,
  });
});
