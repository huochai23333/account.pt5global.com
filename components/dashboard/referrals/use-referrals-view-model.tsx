"use client";

import { useCallback, useMemo, useState } from "react";
import { Package, Plane } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useWorkspaceSyncEffect } from "@/components/dashboard/workspace-session-provider";
import { useLocale } from "@/components/i18n/locale-provider";
import {
  createDashboardSharedCopy,
  type FeedbackTone,
} from "@/components/dashboard/dashboard-shared-ui";
import {
  getReferralsPageData,
  type ReferralBusinessBoard,
  type ReferralsPageData,
} from "@/lib/referrals";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { buildReferralGraph } from "./referrals-graph";
import {
  buildTreeDisplayData,
  createReferralsCopy,
  toReferralErrorMessage,
} from "./referrals-display";

type PageFeedback = { tone: FeedbackTone; message: string } | null;

/**
 * 推荐关系页面的数据刷新、业务切换和树形筛选都由 view-model 维护。
 * Client 因此只根据返回状态选择权限提示、空状态或关系树区块。
 */
export function useReferralsViewModel(initialData: ReferralsPageData) {
  const supabase = getBrowserSupabaseClient();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("Referrals");
  const sharedT = useTranslations("DashboardShared");
  const { locale } = useLocale();
  const copy = useMemo(() => createReferralsCopy(t), [t]);
  const sharedCopy = useMemo(
    () => createDashboardSharedCopy(sharedT),
    [sharedT],
  );

  const [selectedBoard, setSelectedBoard] = useState<ReferralBusinessBoard>(
    initialData.businessBoard,
  );
  const [pendingBoard, setPendingBoard] =
    useState<ReferralBusinessBoard | null>(null);
  const [canViewReferrals, setCanViewReferrals] = useState(
    initialData.canViewReferrals,
  );
  const [availableBoards, setAvailableBoards] = useState(
    initialData.availableBoards,
  );
  const [pageFeedback, setPageFeedback] = useState<PageFeedback>(null);
  const [edges, setEdges] = useState(initialData.edges);
  const [companyRoots, setCompanyRoots] = useState(initialData.companyRoots);
  const [currentViewerId, setCurrentViewerId] = useState<string | null>(
    initialData.currentViewerId,
  );
  const [searchText, setSearchText] = useState("");

  const applyPageData = useCallback((pageData: ReferralsPageData) => {
    setAvailableBoards(pageData.availableBoards);
    setSelectedBoard(pageData.businessBoard);
    setCanViewReferrals(pageData.canViewReferrals);
    setCompanyRoots(pageData.companyRoots);
    setEdges(pageData.edges);
    setCurrentViewerId(pageData.currentViewerId);
  }, []);

  const loadBoardData = useCallback(
    async (businessBoard: ReferralBusinessBoard) => {
      if (!supabase) return;
      setPendingBoard(businessBoard);

      try {
        applyPageData(await getReferralsPageData(supabase, { businessBoard }));
        setPageFeedback(null);
      } catch (error) {
        setPageFeedback({
          message: toReferralErrorMessage(error, copy, sharedCopy),
          tone: "error",
        });
      } finally {
        setPendingBoard(null);
      }
    },
    [applyPageData, copy, sharedCopy, supabase],
  );

  const handleBoardChange = useCallback(
    (businessBoard: ReferralBusinessBoard) => {
      if (
        businessBoard === selectedBoard ||
        pendingBoard ||
        !availableBoards.includes(businessBoard)
      ) {
        return;
      }

      const nextSearchParams = new URLSearchParams(searchParams.toString());
      if (businessBoard === "tourism") nextSearchParams.delete("board");
      else nextSearchParams.set("board", businessBoard);

      const queryString = nextSearchParams.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
      setSearchText("");
      void loadBoardData(businessBoard);
    },
    [
      availableBoards,
      loadBoardData,
      pathname,
      pendingBoard,
      router,
      searchParams,
      selectedBoard,
    ],
  );

  const refreshReferrals = useCallback(
    async ({ isMounted }: { isMounted: () => boolean }) => {
      if (!supabase) return;

      try {
        const nextPageData = await getReferralsPageData(supabase, {
          businessBoard: selectedBoard,
        });
        if (!isMounted()) return;
        applyPageData(nextPageData);
        setPageFeedback(null);
      } catch (error) {
        if (!isMounted()) return;
        setPageFeedback({
          message: toReferralErrorMessage(error, copy, sharedCopy),
          tone: "error",
        });
      }
    },
    [applyPageData, copy, selectedBoard, sharedCopy, supabase],
  );

  useWorkspaceSyncEffect(refreshReferrals);

  const graph = useMemo(
    () => buildReferralGraph(edges, companyRoots, copy.tree.companyBranch),
    [companyRoots, copy.tree.companyBranch, edges],
  );

  return {
    boardTabs: availableBoards.map((board) => ({
      icon:
        board === "tourism" ? (
          <Plane className="size-4" />
        ) : (
          <Package className="size-4" />
        ),
      key: board,
      label: t(`boards.${board}`),
    })),
    canViewReferrals,
    companyRoots,
    copy,
    currentViewerId,
    edges,
    graph,
    handleBoardChange,
    locale,
    pageFeedback,
    pendingBoard,
    searchText,
    selectedBoard,
    setSearchText,
    sharedCopy,
    treeDisplay: buildTreeDisplayData(
      graph,
      searchText,
      locale,
      copy,
      sharedCopy,
    ),
  };
}
