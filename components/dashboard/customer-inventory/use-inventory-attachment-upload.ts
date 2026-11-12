"use client";

import { useRef, useState } from "react";

import {
  confirmInventoryAttachments,
  InventoryAttachmentRegistrationPending,
} from "@/lib/customer-inventory-attachment-registration";
import { uploadCustomerInventoryFiles } from "@/lib/customer-inventory-attachments";
import type { CustomerInventoryAttachment } from "@/lib/customer-inventory-types";

import type { RunInventoryAction } from "./use-customer-inventory-actions";

export function useInventoryAttachmentUpload({
  attachments,
  orderId,
  currentUserId,
  runAction,
  successMessage,
}: {
  attachments: CustomerInventoryAttachment[];
  orderId: string | undefined;
  currentUserId: string | null;
  runAction: RunInventoryAction;
  successMessage: string;
}) {
  const [selection, setSelection] = useState<{ orderId: string; files: File[] }>();
  const [checks, setChecks] = useState<Record<string, string[]>>({});
  const running = useRef(false);
  const files = selection && selection.orderId === orderId ? selection.files : [];
  const paths = orderId ? checks[orderId] : undefined;
  const key = `attachment-upload:${orderId}`;

  function selectFiles(nextFiles: File[]) {
    if (orderId) setSelection({ orderId, files: nextFiles });
  }

  async function submit() {
    if (!orderId || !currentUserId || running.current || (!paths && files.length === 0)) return;
    // React 还没来得及禁用按钮时也要阻止连击。待核对路径按订单保留，切换订单不会串批。
    running.current = true;
    try {
      const completed = await runAction(key, successMessage, async (supabase) => {
        try {
          if (paths) await confirmInventoryAttachments(supabase, orderId, paths);
          else await uploadCustomerInventoryFiles(supabase, {
            existingAttachments: attachments,
            files,
            orderId,
            uploadedByUserId: currentUserId,
          });
        } catch (error) {
          if (error instanceof InventoryAttachmentRegistrationPending) {
            setChecks((current) => ({ ...current, [error.orderId]: error.paths }));
          }
          throw error;
        }
      });
      if (completed) {
        setChecks((current) => {
          const next = { ...current };
          delete next[orderId];
          return next;
        });
        setSelection((current) => current?.orderId === orderId ? undefined : current);
      }
    } finally {
      running.current = false;
    }
  }

  return { files, key, needsCheck: Boolean(paths), selectFiles, submit };
}
