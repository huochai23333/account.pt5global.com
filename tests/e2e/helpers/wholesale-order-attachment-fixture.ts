import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteWholesaleOrderListAttachment,
  type WholesaleOrderListAttachment,
} from "../../../lib/wholesale-order-list-attachments";
import { removeStorageObjectsVerified } from "../../../lib/storage-operation-receipts";
import {
  readWholesaleOrderAttachmentObjects,
  readFeeOrderProof,
  type FeeRow,
} from "./wholesale-fee-database";
import {
  requireFeeUuid,
  type FeeOrderFixture,
} from "./wholesale-fee-order-fixture";

export type AttachmentFile = { name: string; mimeType: string; buffer: Buffer };
type AttachmentRow = WholesaleOrderListAttachment & { _xmin: string };
const bucket = "wholesale-order-lists";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const attachmentSha256 = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

/** 用本次新订单、预声明文件及原会话能力构造；不能挂到共享种子的已有附件上。 */
export function createOrderAttachmentFixture(
  order: FeeOrderFixture,
  files: AttachmentFile[],
  actorClient: () => Promise<SupabaseClient>,
) {
  const baseline = clone(order.proof);
  assert(
    baseline?.order && baseline.attachments.length === 0 && files.length === 2,
    "attachment_fixture_initial_missing",
  );
  const orderId = String(baseline.order.id),
    actor = order.actor;
  requireFeeUuid(orderId);
  requireFeeUuid(actor);
  assert.equal(baseline.order.notes, order.note);
  const declarations = files.map((file) => {
    assert(
      /^[a-zA-Z0-9][a-zA-Z0-9._-]+$/.test(file.name) && file.buffer.length > 0,
      "attachment_fixture_file_invalid",
    );
    return {
      name: file.name,
      mime: file.mimeType,
      bytes: file.buffer.length,
      sha256: attachmentSha256(file.buffer),
    };
  });
  assert.equal(new Set(declarations.map((file) => file.name)).size, 2);
  const paths = new Map<string, string>(),
    objects = new Map<string, FeeRow>(),
    removalStarted = new Set<string>(),
    removed = new Set<string>();
  let registrationPayload: unknown,
    registrationReceipt: WholesaleOrderListAttachment[] | undefined,
    registrations: AttachmentRow[] | undefined,
    interceptedWithoutForward = false,
    cleared = false;

  function read() {
    // 独立JSON快照防止调用者改变旧凭证；Storage这里只读，写入和删除始终走正式API。
    const graph = clone(readFeeOrderProof(orderId));
    const stored = clone(readWholesaleOrderAttachmentObjects(orderId));
    assert.deepEqual(
      { ...graph, attachments: [] },
      baseline,
      "attachment_fixture_order_changed",
    );
    return { graph, stored };
  }
  function expectedRows(excluding?: string) {
    return (registrations ?? []).filter(
      (row) =>
        !removed.has(row.original_name) && row.original_name !== excluding,
    );
  }
  function requireSnapshot(excluding?: string) {
    const snapshot = read(),
      remaining = declarations.filter(
        (file) => !removed.has(file.name) && file.name !== excluding,
      );
    assert.deepEqual(
      snapshot.graph.attachments,
      expectedRows(excluding),
      "attachment_fixture_metadata_changed",
    );
    assert.equal(
      snapshot.stored.length,
      remaining.length,
      "attachment_fixture_object_count_changed",
    );
    for (const file of remaining) {
      const path = paths.get(file.name),
        row = snapshot.stored.find((row) => row.name === path),
        known = objects.get(file.name);
      assert(row && known, "attachment_fixture_object_unconfirmed");
      assert.deepEqual(row, known, "attachment_fixture_object_version_changed");
    }
    return snapshot;
  }
  async function verifyBytes(fileName: string) {
    const file = declarations.find((file) => file.name === fileName),
      path = paths.get(fileName);
    assert(file && path, "attachment_fixture_path_unregistered");
    const { data, error } = await (
      await actorClient()
    ).storage
      .from(bucket)
      .download(path);
    if (error || !data)
      throw new Error("attachment_fixture_download_unconfirmed");
    const bytes = Buffer.from(await data.arrayBuffer());
    assert.equal(
      bytes.length,
      file.bytes,
      "attachment_fixture_download_size_changed",
    );
    assert.equal(
      attachmentSha256(bytes),
      file.sha256,
      "attachment_fixture_download_hash_changed",
    );
  }
  function beginRemoval(fileName: string) {
    assert(
      registrations || interceptedWithoutForward,
      "attachment_fixture_registration_unconfirmed",
    );
    requireSnapshot();
    removalStarted.add(fileName);
  }
  function confirmRemoved(fileName: string) {
    assert(
      removalStarted.has(fileName),
      "attachment_fixture_removal_not_started",
    );
    requireSnapshot(fileName);
    removed.add(fileName);
  }
  return {
    orderId,
    actor,
    files,
    beginUpload(path: string) {
      const root = `${orderId}/${actor}/`;
      assert(path.startsWith(root), "attachment_fixture_path_outside_owner");
      const suffix = path.slice(root.length),
        file = declarations.find((file) => suffix.slice(37) === file.name);
      requireFeeUuid(suffix.slice(0, 36));
      assert(
        suffix[36] === "-" && file && !paths.has(file.name),
        "attachment_fixture_upload_reused",
      );
      const before = read();
      assert.equal(
        before.graph.attachments.length,
        0,
        "attachment_fixture_preexisting_registration",
      );
      assert.equal(
        before.stored.length,
        objects.size,
        "attachment_fixture_preexisting_object",
      );
      paths.set(file.name, path);
      order.dispatchPending++;
      return file.name;
    },
    async confirmUpload(fileName: string, value: unknown) {
      const receipt = value as { Id?: unknown; Key?: unknown },
        path = paths.get(fileName),
        file = declarations.find((file) => file.name === fileName);
      requireFeeUuid(receipt?.Id);
      assert(
        path && file && receipt.Key === `${bucket}/${path}`,
        "attachment_fixture_upload_receipt_changed",
      );
      await verifyBytes(fileName);
      const current = read().stored,
        row = current.find((row) => row.name === path),
        metadata = row?.metadata as Record<string, unknown> | undefined;
      assert(
        row &&
          row.id === receipt.Id &&
          row.owner_id === actor &&
          typeof row.version === "string" &&
          row.version,
        "attachment_fixture_storage_identity_changed",
      );
      assert.equal(Number(metadata?.size), file.bytes);
      assert.equal(metadata?.mimetype, file.mime);
      objects.set(fileName, clone(row));
      order.dispatchPending--;
    },
    register(body: unknown) {
      assert.equal(
        objects.size,
        files.length,
        "attachment_fixture_uploads_unconfirmed",
      );
      const expected = {
        p_order_id: orderId,
        p_attachments: declarations.map((file) => ({
          file_size_bytes: file.bytes,
          mime_type: file.mime,
          original_name: file.name,
          storage_path: paths.get(file.name),
        })),
      };
      assert.deepEqual(
        clone(body),
        expected,
        "attachment_fixture_registration_payload_changed",
      );
      assert(!registrationPayload, "attachment_fixture_registration_repeated");
      registrationPayload = clone(body);
      order.dispatchPending++;
    },
    receiveRegistration(value: unknown) {
      // 不完整回执仍原样交回产品处理；它不是成功，也不能自动取得清理登记的授权。
      if (Array.isArray(value) && value.length === files.length) {
        const rows = clone(value) as WholesaleOrderListAttachment[];
        const valid = rows.every(
          (row) =>
            declarations.some(
              (file) =>
                row.original_name === file.name &&
                row.storage_path === paths.get(file.name) &&
                row.file_size_bytes === file.bytes &&
                row.mime_type === file.mime,
            ) &&
            row.order_id === orderId &&
            row.bucket_name === bucket &&
            row.uploaded_by_user_id === actor &&
            typeof row.id === "string" &&
            typeof row.created_at === "string",
        );
        if (valid && new Set(rows.map((row) => row.id)).size === files.length)
          registrationReceipt = rows;
      }
      order.dispatchPending--;
    },
    markNotForwarded() {
      assert(registrationPayload, "attachment_fixture_request_missing");
      interceptedWithoutForward = true;
      order.dispatchPending--;
    },
    confirmRegistered() {
      assert(
        registrationReceipt,
        "attachment_fixture_registration_receipt_unconfirmed",
      );
      const snapshot = read();
      const rows = snapshot.graph.attachments as AttachmentRow[];
      assert.equal(rows.length, files.length);
      assert.deepEqual(
        rows
          .map(({ _xmin: ignored, ...row }) => {
            void ignored;
            return row;
          })
          .sort((a, b) => a.id.localeCompare(b.id)),
        registrationReceipt.slice().sort((a, b) => a.id.localeCompare(b.id)),
      );
      for (const row of rows) {
        requireFeeUuid(row.id);
        assert(
          /^\d+$/.test(row._xmin),
          "attachment_fixture_metadata_version_missing",
        );
      }
      registrations = clone(rows);
      requireSnapshot();
      return clone(registrations);
    },
    async confirmUnregisteredObjects() {
      assert(
        interceptedWithoutForward,
        "attachment_fixture_server_write_not_excluded",
      );
      requireSnapshot();
      for (const file of declarations) await verifyBytes(file.name);
    },
    verifyPresent() {
      assert(registrations, "attachment_fixture_registration_unconfirmed");
      requireSnapshot();
    },
    verifyBytes,
    beginRemoval,
    confirmRemoved,
    beginRemovalTransport(requestPaths: string[]) {
      assert(
        requestPaths.length > 0 &&
          requestPaths.every((path) =>
            [...paths].some(
              ([name, known]) => known === path && removalStarted.has(name),
            ),
          ),
        "attachment_fixture_removal_outside_manifest",
      );
      order.dispatchPending++;
    },
    finishRemovalTransport() {
      assert(order.dispatchPending > 0);
      order.dispatchPending--;
    },
    requireCleared() {
      assert.equal(
        order.dispatchPending,
        0,
        "attachment_fixture_dispatch_unconfirmed",
      );
      const snapshot = read();
      assert.equal(snapshot.graph.attachments.length, 0);
      assert.equal(snapshot.stored.length, 0);
    },
    async cleanup() {
      if (cleared) {
        assert.equal(readFeeOrderProof(orderId).attachments.length, 0);
        assert.equal(readWholesaleOrderAttachmentObjects(orderId).length, 0);
        return;
      }
      assert.equal(
        order.dispatchPending,
        0,
        "attachment_fixture_dispatch_unconfirmed",
      );
      if (paths.size === 0) {
        const current = read();
        assert.equal(current.graph.attachments.length, 0);
        assert.equal(current.stored.length, 0);
        cleared = true;
        return;
      }
      for (const file of declarations.filter(
        (file) => !removed.has(file.name),
      )) {
        beginRemoval(file.name);
        const client = await actorClient();
        order.dispatchPending++;
        if (registrations) {
          const row = registrations.find(
            (row) => row.original_name === file.name,
          )!;
          await deleteWholesaleOrderListAttachment(client, row);
        } else {
          // 只有本测试明确拦截且从未转发的登记，才允许回收这批已持有完整凭证的孤立对象。
          assert(
            interceptedWithoutForward,
            "attachment_fixture_registration_unconfirmed",
          );
          await removeStorageObjectsVerified(
            client,
            bucket,
            [paths.get(file.name)!],
            {
              confirmationMessage:
                "attachment_fixture_object_remove_unconfirmed",
              timeoutMessage: "attachment_fixture_object_remove_timeout",
            },
          );
        }
        confirmRemoved(file.name);
        order.dispatchPending--;
      }
      const final = read();
      assert.equal(final.graph.attachments.length, 0);
      assert.equal(final.stored.length, 0);
      cleared = true;
    },
  };
}
