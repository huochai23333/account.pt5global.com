"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { useTranslations } from "next-intl";

import {
  CUSTOMER_TYPE_MARK_OPTIONS,
  isCustomerTypeMark,
  type AdminPersonRow,
  type CustomerTypeMark,
} from "@/lib/admin-people-contract";

import {
  normalizeAdminPeopleErrorCode,
  readAdminPeopleUpdateResponse,
  type AdminPeopleFeedback,
} from "./admin-people-view-model-utils";
import type { CustomerTypeLabels } from "./admin-people-display";

export function useAdminCustomerTypeMark({
  setFeedback,
  setPeople,
}: {
  setFeedback: Dispatch<SetStateAction<AdminPeopleFeedback | null>>;
  setPeople: Dispatch<SetStateAction<AdminPersonRow[]>>;
}) {
  const t = useTranslations("AdminPeople");
  const [draftCustomerType, setDraftCustomerType] = useState<
    CustomerTypeMark | ""
  >("");

  const customerTypeLabels = useMemo<CustomerTypeLabels>(
    () => ({
      retail: t("customerTypes.retail"),
    }),
    [t],
  );

  const openCustomerTypeDraft = (person: AdminPersonRow) => {
    setDraftCustomerType(person.customer_type ?? "");
  };

  const handleDraftCustomerTypeChange = (value: string) => {
    if (value === "") {
      setDraftCustomerType("");
      return;
    }

    if (!isCustomerTypeMark(value)) {
      return;
    }

    setDraftCustomerType(value);
  };

  const customerTypeWillChange = (
    person: AdminPersonRow | null,
    draftRole: string,
  ) => {
    if (!person || draftRole !== "client" || !isCustomerTypeMark(draftCustomerType)) {
      return false;
    }

    return person.customer_type !== draftCustomerType;
  };

  const saveCustomerTypeChange = async (
    person: AdminPersonRow,
  ): Promise<AdminPersonRow | null> => {
    if (!isCustomerTypeMark(draftCustomerType)) {
      return person;
    }

    try {
      const response = await fetch("/api/admin/people/customer-type", {
        body: JSON.stringify({
          customerType: draftCustomerType,
          customerUserId: person.user_id,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await readAdminPeopleUpdateResponse(response);

      if (!response.ok || !result.person) {
        setFeedback({
          tone: "error",
          message: t(
            `errors.${normalizeAdminPeopleErrorCode(result.error)}`,
          ),
        });
        return null;
      }

      const updatedPerson = result.person;

      setPeople((currentPeople) =>
        currentPeople.map((item) =>
          item.user_id === updatedPerson.user_id ? updatedPerson : item,
        ),
      );
      setDraftCustomerType(updatedPerson.customer_type ?? draftCustomerType);

      return updatedPerson;
    } catch {
      setFeedback({
        tone: "error",
        message: t("errors.serviceUnavailable"),
      });
    }

    return null;
  };

  return {
    customerTypeLabels,
    customerTypeOptions: CUSTOMER_TYPE_MARK_OPTIONS,
    customerTypeWillChange,
    draftCustomerType,
    handleDraftCustomerTypeChange,
    openCustomerTypeDraft,
    saveCustomerTypeChange,
  };
}
