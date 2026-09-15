import type { AppRole } from "@/lib/auth-routing";

export type AiAssistantMessageRole = "assistant" | "user";

export type AiAssistantChatMessage = {
  content: string;
  role: AiAssistantMessageRole;
};

export type AiAssistantLocale = "en" | "zh";

export type AiAssistantChatRequest = {
  history?: AiAssistantChatMessage[];
  locale?: AiAssistantLocale;
  message: string;
  pathname?: string;
  requestId: string;
};

export type AiAssistantSettlementReleaseCustomerKind =
  | "existing"
  | "temporary";

export type AiAssistantSettlementReleaseAction = {
  amount: number;
  currency: string;
  customerId: string | null;
  customerKind: AiAssistantSettlementReleaseCustomerKind;
  customerName: string;
  inputCustomerName: string;
  note: string | null;
  receivedOn: string;
  requestId: string;
};

export type AiAssistantSettlementReleaseGuidanceCode =
  | "ambiguousCustomer"
  | "invalidAmount"
  | "invalidCurrency"
  | "invalidDate"
  | "missingAmount"
  | "missingCurrency"
  | "missingCustomer"
  | "multipleAmounts"
  | "notAllowed";

export type AiAssistantStructuredResponse =
  | {
      action: AiAssistantSettlementReleaseAction;
      kind: "settlementReleaseConfirmation";
    }
  | {
      code: AiAssistantSettlementReleaseGuidanceCode;
      kind: "settlementReleaseGuidance";
    };

export type AiAssistantSettlementReleaseConfirmRequest = {
  action: AiAssistantSettlementReleaseAction;
};

export type AiAssistantSettlementReleaseConfirmResponse = {
  releaseId: string;
};

export type AiAssistantChatErrorCode =
  | "invalidInput"
  | "notSignedIn"
  | "resultConfirming"
  | "requestTooLarge"
  | "tooManyRequests"
  | "serviceUnavailable";

export type AiAssistantSettlementReleaseErrorCode =
  | "customerChanged"
  | "forbidden"
  | "invalidInput"
  | "notSignedIn"
  | "requestConflict"
  | "requestTooLarge"
  | "serviceUnavailable";

export type AiAssistantPromptContext = {
  locale: AiAssistantLocale;
  pathname: string;
  role: AppRole | null;
};
