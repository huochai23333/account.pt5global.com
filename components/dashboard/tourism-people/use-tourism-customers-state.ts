"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  addClientToBusiness,
  type ClientBusinessCandidate,
} from "@/lib/client-business-access";
import type { AdminPeoplePageData, AdminPersonRow } from "@/lib/admin-people-contract";
import { getBrowserSupabaseClient } from "@/lib/supabase";

import { filterTourismPeople, isTourismCustomer } from "./tourism-people-display";

const ALL = "all";

export function useTourismCustomersState(
  initialData: AdminPeoplePageData,
  businessCandidates: ClientBusinessCandidate[],
) {
  const router = useRouter();
  const accessT = useTranslations("ClientBusinessAccess");
  const [people, setPeople] = useState(initialData.people);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [selectedCustomer, setSelectedCustomer] =
    useState<AdminPersonRow | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const [addCandidates, setAddCandidates] = useState(businessCandidates);

  useEffect(() => {
    setPeople(initialData.people);
  }, [initialData.people]);

  useEffect(() => {
    setAddCandidates(businessCandidates);
  }, [businessCandidates]);

  const tourismCustomers = useMemo(
    () => people.filter(isTourismCustomer),
    [people],
  );
  const filteredCustomers = useMemo(
    () => filterTourismPeople(tourismCustomers, searchText, statusFilter),
    [tourismCustomers, searchText, statusFilter],
  );

  const addCustomer = async (userId: string) => {
    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      setFeedback({
        message: accessT("serviceUnavailable"),
        tone: "error",
      });
      return false;
    }

    setPendingUserId(userId);
    setFeedback(null);

    try {
      await addClientToBusiness(supabase, userId, "tourism");
      setPeople((current) =>
        current.map((person) =>
          person.user_id === userId
            ? {
                ...person,
                workspace_business_access: Array.from(
                  new Set([
                    ...person.workspace_business_access,
                    "tourism" as const,
                  ]),
                ),
              }
            : person,
        ),
      );
      setAddCandidates((current) =>
        current.filter((candidate) => candidate.userId !== userId),
      );
      setFeedback({
        message: accessT("success", {
          business: accessT("businesses.tourism"),
        }),
        tone: "success",
      });
      router.refresh();
      return true;
    } catch (error) {
      setFeedback({ message: mapAddError(error, accessT), tone: "error" });
      return false;
    } finally {
      setPendingUserId(null);
    }
  };

  return {
    activeCount: tourismCustomers.filter(
      (customer) => customer.status === "active",
    ).length,
    addCandidates,
    addCustomer,
    addDialogOpen,
    feedback,
    filteredCustomers,
    hasFilters: Boolean(searchText || statusFilter !== ALL),
    pendingUserId,
    resetFilters: () => {
      setSearchText("");
      setStatusFilter(ALL);
    },
    searchText,
    selectedCustomer,
    setAddDialogOpen,
    setSearchText,
    setSelectedCustomer,
    setStatusFilter,
    statusFilter,
    tourismCustomers,
  };
}

function mapAddError(
  error: unknown,
  t: (key: string, values?: Record<string, string>) => string,
) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";

  if (message.includes("forbidden")) return t("forbidden");
  if (message.includes("target_")) return t("invalidTarget");
  if (message.includes("fetch") || message.includes("network")) {
    return t("serviceUnavailable");
  }

  return t("unknownError");
}
