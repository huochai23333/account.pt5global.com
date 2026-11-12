"use client";

import { useMemo, useState } from "react";

import type { AdminPeoplePageData, AdminPersonRow } from "@/lib/admin-people-contract";

import { filterTourismPeople, isTourismPromoter } from "./tourism-people-display";

const ALL_STATUSES = "all";

/**
 * 旅游人员目录的筛选与详情选择状态集中在 view-model。
 * 页面组件只渲染筛选区、列表和弹窗，不再自行计算人员范围或搜索结果。
 */
export function useTourismPeopleViewModel(initialData: AdminPeoplePageData) {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [selectedPerson, setSelectedPerson] = useState<AdminPersonRow | null>(
    null,
  );

  // 业务人员目录只展示推广人员，客户继续由独立客户目录承接。
  const promoters = useMemo(
    () => initialData.people.filter(isTourismPromoter),
    [initialData.people],
  );
  const filteredPeople = useMemo(
    () => filterTourismPeople(promoters, searchText, statusFilter),
    [promoters, searchText, statusFilter],
  );

  return {
    activeCount: promoters.filter((person) => person.status === "active").length,
    closeDetails: () => setSelectedPerson(null),
    filteredPeople,
    hasFilters: Boolean(searchText || statusFilter !== ALL_STATUSES),
    openDetails: setSelectedPerson,
    promoters,
    resetFilters: () => {
      setSearchText("");
      setStatusFilter(ALL_STATUSES);
    },
    searchText,
    selectedPerson,
    setSearchText,
    setStatusFilter,
    statusFilter,
  };
}
