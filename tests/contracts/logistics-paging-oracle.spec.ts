import assert from "node:assert/strict";
import { test } from "@playwright/test";
import { assertLogisticsPaging, validateLogisticsFixture } from "../e2e/helpers/logistics-paging-oracle";

// Synthetic fixture order is independently known: all timestamps tie, IDs descend.
const rows = Array.from({ length: 55 }, (_, index) => ({
  id: `af000000-0000-4000-8000-${String(55 - index).padStart(12, "0")}`,
  packageNumber: `QA-PAGING-${String(55 - index).padStart(3, "0")}`,
  sortAt: "2026-01-15T00:00:00.000Z",
}));
const pageRows = rows.map(({ id, packageNumber }) => ({ id, packageNumber }));
const pages = () => [pageRows.slice(0, 20), pageRows.slice(20, 40), pageRows.slice(40)];
const fixture = () => validateLogisticsFixture({ synthetic: true, storeName: "Local Paging Shop", rows: [...rows].reverse() });

test("55 fixed fixture IDs, tie-break sort and previous-page round trip pass", () => {
  assert.deepEqual(fixture(), rows);
  assertLogisticsPaging(fixture(), pages(), pageRows.slice(20, 40));
});
test("same counts with duplicated page must fail", () => {
  const actual = pages(); actual[1] = [...actual[0]];
  assert.throws(() => assertLogisticsPaging(fixture(), actual, actual[1]), /duplicated IDs/);
});
test("55 unique IDs with a substituted record must fail", () => {
  const actual = pages(); actual[2][14] = { id: "af000000-0000-4000-8000-000000000099", packageNumber: "QA-PAGING-099" };
  assert.throws(() => assertLogisticsPaging(fixture(), actual, actual[1]), /independent fixture ID set/);
});
test("right set in wrong order must fail", () => {
  const actual = pages(); actual[0] = [...actual[0]].reverse();
  assert.throws(() => assertLogisticsPaging(fixture(), actual, actual[1]), /stable ordering/);
});
test("same ID with wrong visible package identity must fail", () => {
  const actual = pages(); actual[0][0] = { ...actual[0][0], packageNumber: "WRONG-PACKAGE" };
  assert.throws(() => assertLogisticsPaging(fixture(), actual, actual[1]), /package identity/);
});
test("previous-page reorder must fail", () => {
  assert.throws(() => assertLogisticsPaging(fixture(), pages(), pageRows.slice(20, 40).reverse()), /returning to the second page/);
});
test("missing row must fail", () => {
  const actual = pages(); actual[2] = actual[2].slice(0, 14);
  assert.throws(() => assertLogisticsPaging(fixture(), actual, actual[1]), /page sizes/);
});
test("timestamp order takes precedence over UUID order", () => {
  const mixed = rows.map((row, i) => ({ ...row, sortAt: i === 54 ? "2026-01-16T00:00:00Z" : row.sortAt }));
  assert.equal(validateLogisticsFixture({ synthetic: true, storeName: "Local Paging Shop", rows: mixed })[0].id, rows[54].id);
});

test("microsecond timestamp order takes precedence over a larger UUID", () => {
  // 两个时间只相差一微秒；手写期望顺序，不调用被测排序器生成期望。
  const mixed = rows.map((row) => ({ ...row }));
  mixed[0].sortAt = "2026-01-16T00:00:00.123456Z";
  mixed[54].sortAt = "2026-01-16T00:00:00.123457Z";
  const sorted = validateLogisticsFixture({ synthetic: true, storeName: "Local Paging Shop", rows: mixed });
  assert.deepEqual(sorted.slice(0, 2).map((row) => row.id), [rows[54].id, rows[0].id]);
});
test("equal instants with different offsets use UUID ordering", () => {
  // 北京时间 08:00 与 UTC 00:00 是同一时刻，较大 UUID 应排在前面。
  const mixed = rows.map((row, i) => ({ ...row, sortAt: i % 2 ? "2026-01-15T08:00:00.000000+08:00" : row.sortAt }));
  assert.deepEqual(validateLogisticsFixture({ synthetic: true, storeName: "Local Paging Shop", rows: mixed }).map((row) => row.id), rows.map((row) => row.id));
});

for (const [name, overrides, message] of [
  ["missing row", { rows: rows.slice(0, 54) }, /exactly 55/],
  ["duplicate IDs", { rows: rows.map((row) => ({ ...row, id: rows[0].id })) }, /fixture IDs must be unique/],
  ["duplicate packages", { rows: rows.map((row) => ({ ...row, packageNumber: rows[0].packageNumber })) }, /package numbers must be unique/],
  ["non-synthetic manifest", { synthetic: false }, /synthetic/],
] as const) {
  test(`isolated invalid fixture: ${name}`, () => {
    // 每次只破坏一个条件，不能让重复 ID 替包裹编号检查挡住错误。
    const valid = { synthetic: true, storeName: "Local Paging Shop", rows };
    assert.throws(() => validateLogisticsFixture({ ...valid, ...overrides }), message);
  });
}

for (const timestamp of [
  "2026-01-15T00:00:00", "2026-02-30T00:00:00Z", "2026-01-15T24:00:00Z",
  "2026-01-15T00:00:00.1234567Z", "2026-01-15T00:00:00+24:00", "2026-01-15T00:00:00+08:60",
]) {
  test(`invalid timestamp is rejected: ${timestamp}`, () => {
    const invalid = rows.map((row, index) => ({ ...row, sortAt: index === 0 ? timestamp : row.sortAt }));
    assert.throws(() => validateLogisticsFixture({ synthetic: true, storeName: "Local Paging Shop", rows: invalid }), /fixture timestamp/);
  });
}
