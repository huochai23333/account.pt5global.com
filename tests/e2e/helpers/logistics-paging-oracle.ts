import assert from "node:assert/strict";

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
    assert(Number.isFinite(Date.parse(row.sortAt)), "independent fixture sort timestamp required");
  }
  assert.equal(new Set(manifest.rows.map((row) => row.id)).size, 55, "fixture IDs must be unique");
  assert.equal(new Set(manifest.rows.map((row) => row.packageNumber)).size, 55, "fixture package numbers must be unique");
  // Documented order: effective order timestamp descending, stable UUID descending.
  // sortAt is fixed when preparing the fixture, not derived from RPC results.
  return [...manifest.rows].sort((a, b) => Date.parse(b.sortAt) - Date.parse(a.sortAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
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
