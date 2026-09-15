"use client";

import { useMemo, useState } from "react";
import { readAssistantEventStream } from "@/lib/ai-assistant/assistant-event-stream";

export type WholesaleOrderAssessmentFilters = {
  customerId: string;
  orderedFromDate: string;
  orderedToDate: string;
  salesUserId: string;
  searchText: string;
  status: string;
};

export function useWholesaleOrderAssessment(
  filters: WholesaleOrderAssessmentFilters,
) {
  const [rawAssessment, setRawAssessment] = useState("");
  const [assessmentFilterKey, setAssessmentFilterKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const assessment = useMemo(
    () => sanitizeWholesaleAssessmentText(rawAssessment),
    [rawAssessment],
  );
  const hasStaleAssessment =
    Boolean(assessment) && assessmentFilterKey !== filterKey;

  const generateAssessment = async () => {
    setPending(true);
    setErrorMessage("");
    setRawAssessment("");
    setAssessmentFilterKey(filterKey);

    try {
      const response = await fetch("/api/wholesale/order-assessment", {
        body: JSON.stringify({ filters, requestId: crypto.randomUUID() }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readAssessmentErrorMessage(response));
      }

      if (!response.body) throw new Error("assessment_failed");
      await readAssistantEventStream(response.body, (chunk) => {
        setRawAssessment((current) => `${current}${chunk}`);
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message !== "assessment_failed"
          ? error.message
          : "评估暂时没有生成成功，请稍后再试。",
      );
    } finally {
      setPending(false);
    }
  };

  return {
    assessment,
    errorMessage,
    generateAssessment,
    hasStaleAssessment,
    pending,
  };
}
async function readAssessmentErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };

    return typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : "assessment_failed";
  } catch {
    return "assessment_failed";
  }
}

function sanitizeWholesaleAssessmentText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      let nextLine = line.trimEnd();

      nextLine = nextLine
        .replace(/^\s*#{1,6}\s*/, "")
        .replace(/^\s*[-*+]\s+/, "· ")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/\*([^*\n]+)\*/g, "$1")
        .replace(/_([^_\n]+)_/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*/g, "");

      return nextLine.trimEnd();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
