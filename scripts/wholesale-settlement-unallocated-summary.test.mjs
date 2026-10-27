import assert from "node:assert/strict";
import test from "node:test";
import { getMonthlySettlementUnallocatedSummary as summarize } from "../lib/wholesale-settlement-release-summary.ts";

const now = new Date("2026-10-15T12:00:00Z");
const release = (id, amount, extra = {}) => ({
  id, release_amount: amount, release_currency: "USD",
  received_on: "2026-10-01", status: "pending", ...extra,
});
const allocation = (id, amount, extra = {}) => ({
  release_id: id, allocation_amount: amount, status: "active", ...extra,
});

test("month follows Shanghai at the UTC boundary, including December rollover", () => {
  for (const [instant, start, next] of [
    ["2026-09-30T15:59:59.999Z", "2026-09-01", "2026-10-01"],
    ["2026-09-30T16:00:00.000Z", "2026-10-01", "2026-11-01"],
    ["2026-10-31T15:59:59.999Z", "2026-10-01", "2026-11-01"],
    ["2026-10-31T16:00:00.000Z", "2026-11-01", "2026-12-01"],
    ["2026-12-31T15:59:59.999Z", "2026-12-01", "2027-01-01"],
    ["2026-12-31T16:00:00.000Z", "2027-01-01", "2027-02-01"],
  ]) {
    const result = summarize([], [], new Date(instant));
    assert.equal(result.monthStart, start);
    assert.equal(result.nextMonthStart, next);
  }
});

test("receipt date includes the first and last day, excluding other months regardless of publication date", () => {
  const result = summarize([
    release("first", 10, { received_on: "2026-10-01", created_at: "2026-11-01T00:00:00Z" }),
    release("last", 20, { received_on: "2026-10-31" }),
    release("previous", 100, { received_on: "2026-09-30", created_at: now.toISOString() }),
    release("next", 200, { received_on: "2026-11-01" }),
  ], [], now);
  assert.deepEqual(result.amounts, [{ currency: "USD", amount: 30 }]);
});

test("deducts all active allocations regardless of creation date, ignoring reversed history", () => {
  const result = summarize([release("partial", 100, { status: "partially_allocated" })], [
    allocation("partial", 15, { created_at: "2026-09-30T23:00:00Z" }),
    allocation("partial", 20, { created_at: "2026-11-01T00:00:00Z" }),
    allocation("partial", 50, { status: "reversed" }),
    allocation("other-release", 500),
  ], now);
  assert.deepEqual(result.amounts, [{ currency: "USD", amount: 65 }]);
});

test("cancelled and allocated receipts are excluded; zero and negative balances are omitted", () => {
  const result = summarize([
    release("cancelled", 100, { status: "cancelled" }),
    release("allocated", 100, { status: "allocated" }),
    release("zero", 100, { status: "partially_allocated" }),
    release("over", 100, { status: "partially_allocated" }),
  ], [allocation("zero", 100), allocation("over", 120)], now);
  assert.deepEqual(result.amounts, []);
});

test("currency totals are separate and sorted, using exact decimal cents", () => {
  const result = summarize([
    release("usd", 0.3),
    release("cny-1", 0.29, { release_currency: "CNY" }),
    release("cny-2", 0.1, { release_currency: "CNY" }),
    release("eur", 1.01, { release_currency: "EUR" }),
  ], [allocation("usd", 0.1), allocation("usd", 0.2)], now);
  assert.deepEqual(result.amounts, [
    { currency: "CNY", amount: 0.39 },
    { currency: "EUR", amount: 1.01 },
  ]);
});

test("empty month and clearing allocations restore the expected balances", () => {
  assert.deepEqual(summarize([], [], now).amounts, []);
  assert.deepEqual(summarize([release("r", 12.34)], [allocation("r", 12.34, { status: "reversed" })], now).amounts,
    [{ currency: "USD", amount: 12.34 }]);
});

test("does not truncate a complete collection at an API page boundary", () => {
  const releases = Array.from({ length: 1001 }, (_, index) => release(String(index), 0.01));
  assert.deepEqual(summarize(releases, [], now).amounts, [{ currency: "USD", amount: 10.01 }]);
});

test("invalid amounts and unsafe totals fail instead of displaying a false financial balance", () => {
  assert.throws(() => summarize([release("invalid", Number.NaN)], [], now), /金额格式无效/);
  const releases = Array.from({ length: 100 }, (_, index) => release(String(index), 999999999999.99));
  assert.throws(() => summarize(releases, [], now), /超出可精确显示的范围/);
});
