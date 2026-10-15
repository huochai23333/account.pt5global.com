"use client";

import { useSearchParams } from "next/navigation";
import type { WholesaleCommissionBoard } from "@/lib/wholesale-commission-boards";

/** 地址只保存当前标签；最终选择必须落在服务端提供的可用标签内。 */
export function useWholesaleCommissionBoard(boards: WholesaleCommissionBoard[]) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("board");
  const board = boards.find((item) => item === requested) ?? boards[0];

  function selectBoard(next: WholesaleCommissionBoard) {
    if (!boards.includes(next)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("board", next);
    // 原生历史接口与 Next 路由同步，切换时无需重新挂载明细，筛选和分页因此得以保留。
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return { board, selectBoard };
}
