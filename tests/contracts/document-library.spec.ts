import { expect, test } from "@playwright/test";
import { inspectDocument } from "@/lib/document-library/file-policy";
import { requireDocumentReceipt } from "@/lib/document-library/model";

// 格式判断由服务端读取真实字节；浏览器填入的 MIME 不参与信任判断。
test("资料格式、空文件和三个大小边界由服务端独立检查", () => {
  expect(inspectDocument("中文.txt", Buffer.from("实际文字")).mime).toBe("text/plain");
  expect(() => inspectDocument("空.txt", Buffer.alloc(0))).toThrow("invalid");
  expect(() => inspectDocument("伪装.pdf", Buffer.from("text"))).toThrow("invalid");
  expect(() => inspectDocument("危险.html", Buffer.from("text"))).toThrow("invalid");
  expect(() => inspectDocument("../越界.txt", Buffer.from("text"))).toThrow("invalid");
  const image = Buffer.alloc(5 * 1024 * 1024); Buffer.from("89504e470d0a1a0a", "hex").copy(image);
  expect(() => inspectDocument("超限.png", image)).toThrow("size");
  const video = Buffer.alloc(30 * 1024 * 1024); video.write("ftyp", 4);
  expect(() => inspectDocument("超限.mp4", video)).toThrow("size");
  const text = Buffer.alloc(20 * 1024 * 1024, 65);
  expect(inspectDocument("边界.txt", text).sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(() => inspectDocument("超限.txt", Buffer.concat([text, Buffer.from("a")]))).toThrow("size");
});
test("写入凭证必须对应原操作、有记录版本和实际影响行数", () => {
  const receipt = { operationId: "op", action: "delete_file", status: "succeeded", affectedCount: 1, record: { id: "file", version: 3 } };
  expect(requireDocumentReceipt(receipt, "op")).toEqual(receipt);
  expect(() => requireDocumentReceipt(receipt, "other")).toThrow();
  expect(() => requireDocumentReceipt({ ...receipt, affectedCount: 0 }, "op")).toThrow();
  expect(() => requireDocumentReceipt({ ...receipt, record: { id: "file" } }, "op")).toThrow();
  expect(() => requireDocumentReceipt({ ...receipt, status: "partial_failed" }, "op")).toThrow();
});
