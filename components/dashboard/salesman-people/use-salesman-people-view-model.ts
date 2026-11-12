"use client";

import { useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import {
  type SalesmanCustomerRow,
  type SalesmanPeoplePageData,
} from "@/lib/salesman-people-contract";
import { usePersonPrivateNoteEditor } from "@/components/dashboard/person-notes/use-person-private-note-editor";

import { useSalesmanCustomerTypeEditor, type SalesmanPeopleFeedback } from "./use-salesman-customer-type-editor";

import {
  getSalesmanCustomerName,
  salesmanCustomerMatchesSearch,
} from "./salesman-people-display";

export function useSalesmanPeopleViewModel({
  initialData,
}: {
  initialData: SalesmanPeoplePageData;
}) {
  const t = useTranslations("SalesmanPeople");
  const [customers, setCustomers] = useState(initialData.customers);
  const [feedback, setFeedback] = useState<SalesmanPeopleFeedback | null>(null);
  const [searchText, setSearchText] = useState("");
  // 列表只协调当前资料；客户标记和备注分别交给自己的编辑器。
  const customerTypeEditor = useSalesmanCustomerTypeEditor({
    businessBoards: initialData.businessBoards,
    setCustomers,
    setFeedback,
  });
  const personNoteEditor = usePersonPrivateNoteEditor<SalesmanCustomerRow>({
    getTargetName: (customer) =>
      getSalesmanCustomerName(customer, t("fallback.unnamedCustomer")),
    onSaved: (targetUserId, privateNote) => {
      setCustomers((currentCustomers) =>
        currentCustomers.map((customer) =>
          customer.user_id === targetUserId
            ? { ...customer, private_note: privateNote }
            : customer,
        ),
      );
    },
    setFeedback,
  });

  const summary = useMemo(() => {
    const retailCount = customers.filter(
      (customer) => customer.customer_type === "retail",
    ).length;

    return {
      retailCount,
      totalCount: customers.length,
      unmarkedCount: customers.length - retailCount,
    };
  }, [customers]);

  const filteredCustomers = useMemo(
    () =>
      customers.filter((customer) =>
        salesmanCustomerMatchesSearch(customer, searchText),
      ),
    [customers, searchText],
  );

  return {
    ...customerTypeEditor,
    currentViewerId: initialData.currentViewerId,
    businessBoards: initialData.businessBoards,
    feedback,
    filteredCustomers,
    hasPermission: initialData.hasPermission,
    personNoteEditor,
    searchText,
    summary,
    setSearchText,
  };
}
