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
test("invalid or duplicate fixture manifest must fail before browser clicks", () => {
  assert.throws(() => validateLogisticsFixture({ synthetic: true, storeName: "Local Paging Shop", rows: rows.slice(0, 54) }), /exactly 55/);
  assert.throws(() => validateLogisticsFixture({ synthetic: true, storeName: "Local Paging Shop", rows: Array(55).fill(rows[0]) }), /unique/);
  assert.throws(() => validateLogisticsFixture({ synthetic: false, storeName: "Local Paging Shop", rows }), /synthetic/);
});
