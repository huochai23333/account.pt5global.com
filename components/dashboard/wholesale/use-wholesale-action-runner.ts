"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase";
import { runVerifiedActionWithRefresh } from "@/lib/verified-action-outcome";

import { toWholesaleActionErrorMessage } from "./wholesale-action-utils";

export type WholesaleActionFeedback = {
  tone: "error" | "info" | "success";
  message: string;
} | null;

export type WholesaleActionRefreshMode = "none" | "router";

export type WholesaleActionOptions = {
  afterSuccess?: () => Promise<void> | void;
  refreshMode?: WholesaleActionRefreshMode;
};

export type RunWholesaleAction = (
  key: string,
  successMessage: string,
  action: () => Promise<void>,
  options?: WholesaleActionOptions,
) => Promise<boolean>;

/**
 * 批发模块所有写操作共用的执行器。
 *
 * 返回布尔值的目的，是让弹窗知道请求是否真的成功：只有成功时才能清空表单或关闭弹窗。
 * 订单列表拥有自己的局部刷新逻辑，因此可以传入 `none`，避免同时触发整页刷新和列表刷新。
 */
export function useWholesaleActionRunner() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<WholesaleActionFeedback>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const activeActionKeyRef = useRef<string | null>(null);

  const runAction = useCallback<RunWholesaleAction>(
    async (key, successMessage, action, options) => {
      // 状态更新要等下一次渲染才会反映到按钮上，而 ref 会立刻改变。
      // 因此连续点击即使发生在同一帧，也只能有第一个动作进入数据库请求。
      if (activeActionKeyRef.current !== null) return false;

      const supabase = getBrowserSupabaseClient();

      if (!supabase) {
        setFeedback({
          tone: "error",
          message: "当前无法连接系统，请刷新页面后再试。",
        });
        return false;
      }

      activeActionKeyRef.current = key;
      setPendingKey(key);
      setFeedback(null);

      try {
        // 写入回执已经证明资料保存成功。局部重读若失败，只影响页面显示，
        // 不能把已完成的写入改报为失败，否则用户再次提交会产生重复业务结果。
        const outcome = await runVerifiedActionWithRefresh(
          action,
          options?.afterSuccess,
        );
        if (outcome === "refreshing") {
          setFeedback({
            tone: "info",
            message: "资料已经保存，页面内容正在刷新，请稍后核对。",
          });
          router.refresh();
          return true;
        }

        setFeedback({ tone: "success", message: successMessage });

        if ((options?.refreshMode ?? "router") === "router") {
          router.refresh();
        }

        return true;
      } catch (error) {
        setFeedback({
          tone: "error",
          message: toWholesaleActionErrorMessage(error),
        });
        return false;
      } finally {
        if (activeActionKeyRef.current === key) {
          activeActionKeyRef.current = null;
          setPendingKey(null);
        }
      }
    },
    [router],
  );

  return {
    feedback,
    pendingKey,
    runAction,
  };
}
