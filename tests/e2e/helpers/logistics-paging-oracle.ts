import assert from "node:assert/strict";
import { fixtureTimestampMicros } from "./logistics-fixture-time";

export type LogisticsPagingRow = { id: string; packageNumber: string };
export type LogisticsFixtureRow = LogisticsPagingRow & { sortAt: string };

export function validateLogisticsFixture(value: unknown): LogisticsFixtureRow[] {
  assert(value && typeof value === "object", "fixture manifest must be an object");
  const manifest = value as { synthetic?: boolean; storeName?: string; rows?: LogisticsFixtureRow[] };
  assert.equal(manifest.synthetic, true, "only a declared synthetic fixture is accepted; declaration is not physical isolation");
  assert.equal(manifest.storeName, "Local Paging Shop");
  assert(Array.isArray(manifest.rows), "fixture rows must be an array");
  assert.equal(manifest.rows.length, 55, "fixture must contain exactly 55 rows");
  for (const row of manifest.rows) {
    assert(row && typeof row === "object");
    assert.match(row.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, "stable UUID required");
    assert.equal(typeof row.packageNumber, "string");
    assert(row.packageNumber.trim(), "package number cannot be empty");
    assert.equal(typeof row.sortAt, "string");
    fixtureTimestampMicros(row.sortAt);
  }
  assert.equal(new Set(manifest.rows.map((row) => row.id)).size, 55, "fixture IDs must be unique");
  assert.equal(new Set(manifest.rows.map((row) => row.packageNumber)).size, 55, "fixture package numbers must be unique");
  // 时间来自独立准备的清单，不取自被测接口；时间相同才按 UUID 降序。
  // 先保留数据库的微秒精度，再比较，不能让较大的 UUID 掩盖较新的时间。
  return manifest.rows.map((row) => ({ row, micros: fixtureTimestampMicros(row.sortAt) }))
    .sort((a, b) => a.micros === b.micros
      ? (a.row.id < b.row.id ? 1 : a.row.id > b.row.id ? -1 : 0)
      : a.micros > b.micros ? -1 : 1)
    .map(({ row }) => row);
}

export function assertLogisticsPaging(fixture: LogisticsFixtureRow[], pages: LogisticsPagingRow[][], returnedSecond: LogisticsPagingRow[]) {
  assert.deepEqual(pages.map((page) => page.length), [20, 20, 15], "page sizes");
  const actual = pages.flat();
  assert.equal(new Set(actual.map((row) => row.id)).size, 55, "no duplicated IDs across pages");
  const expected = fixture.map(({ id, packageNumber }) => ({ id, packageNumber }));
  assert.deepEqual([...actual.map((row) => row.id)].sort(), [...expected.map((row) => row.id)].sort(), "exact independent fixture ID set");
  assert.deepEqual(actual, expected, "stable ordering and package identity across all pages");
  assert.deepEqual(returnedSecond, pages[1], "returning to the second page preserves identities and order");
}
