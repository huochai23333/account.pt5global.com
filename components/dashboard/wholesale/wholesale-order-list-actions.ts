import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  deleteWholesaleOrderListAttachment,
  WholesaleAttachmentDeleteIncomplete,
  type WholesaleOrderListAttachment,
} from "@/lib/wholesale-order-list-attachments";
import { WholesaleOrderListRegistrationPending } from "@/lib/wholesale-order-list-registration";
import {
  uploadWholesaleOrderListFiles,
  WholesaleOrderListUploadPending,
} from "@/lib/wholesale-order-list-upload";

import type { RunWholesaleAction } from "./use-wholesale-action-runner";

/** Order List 附件在当前订单页局部更新，不触发整页刷新。 */
export function createWholesaleOrderListActions(
  runAction: RunWholesaleAction,
  messages: {
    uploaded: string;
    deleted: string;
    uploadUnconfirmed: string;
    uploadFailed: string;
    deleteIncomplete: string;
    deleteFailed: string;
  },
) {
  const uploadOrderListAttachments = ({
    existingAttachments,
    files,
    orderId,
    uploadedByUserId,
  }: {
    existingAttachments: WholesaleOrderListAttachment[];
    files: File[];
    orderId: string;
    uploadedByUserId: string;
  }) =>
    runAction(
      `order-list:upload:${orderId}`,
      messages.uploaded,
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        // 上传模块按当前用户、订单及原文件摘要保留准确范围，同页和跨页重试走同一条链路。
        await uploadWholesaleOrderListFiles(supabase, {
          existingAttachments,
          files,
          orderId,
          uploadedByUserId,
        });
      },
      {
        refreshMode: "none",
        getErrorMessage: (error) =>
          error instanceof WholesaleOrderListRegistrationPending ||
          error instanceof WholesaleOrderListUploadPending
            ? messages.uploadUnconfirmed
            : messages.uploadFailed,
      },
    );

  const deleteOrderListAttachment = (
    attachment: WholesaleOrderListAttachment,
  ) =>
    runAction(
      `order-list:delete:${attachment.id}`,
      messages.deleted,
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        await deleteWholesaleOrderListAttachment(supabase, attachment);
      },
      {
        refreshMode: "none",
        getErrorMessage: (error) =>
          error instanceof WholesaleAttachmentDeleteIncomplete
            ? messages.deleteIncomplete
            : messages.deleteFailed,
      },
    );

  return {
    deleteOrderListAttachment,
    uploadOrderListAttachments,
  };
}
