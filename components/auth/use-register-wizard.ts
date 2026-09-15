"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";
import type { CountryCode } from "libphonenumber-js";
import { useLocale, useTranslations } from "next-intl";

import {
  getRoleFromAuthClaims,
} from "@/lib/auth-session-client";
import type { Locale } from "@/lib/locale";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { requireAuthUserReceipt } from "@/lib/auth-operation-receipts";
import { getCurrentWorkspaceBusinessAccess } from "@/lib/workspace-business-access";
import { getSignedInWorkspaceDestination } from "@/lib/workspace-business-availability";

import { getPasswordPolicyState } from "./auth-password-policy";
import {
  defaultSignupBusiness,
  getNextRegisterStep,
  getPreviousRegisterStep,
  getRegisterStepIndex,
  hasBusinessSelectionStep,
} from "./register-flow";
import {
  formatAuthError,
  formatReferralCodeStatus,
  getSignupInviteContext,
  isRegisteredEmailSignupResult,
} from "./register-form-validation";
import type {
  RegisterFormState,
  RegisterStep,
  SignupBusiness,
  SignupInviteContext,
} from "./register-form-types";
import {
  normalizeInternationalPhone,
  resolveBrowserCountry,
} from "./register-phone-utils";

export function useRegisterWizard(
  initialInviteCode: string | null | undefined,
) {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations("RegisterForm");
  const [step, setStep] = useState<RegisterStep>("invite");
  const [direction, setDirection] = useState(1);
  const [checkingInvite, setCheckingInvite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteContext, setInviteContext] = useState<SignupInviteContext>({
    locksBusiness: false,
    status: "optional",
    suggestedBusinessKey: null,
  });
  const [state, setState] = useState<RegisterFormState>({
    acceptedTerms: false,
    business: defaultSignupBusiness,
    country: locale === "zh" ? "CN" : "US",
    email: "",
    inviteCode: normalizeInitialInviteCode(initialInviteCode),
    name: "",
    password: "",
    phoneNational: "",
  });

  useEffect(() => {
    setState((current) => ({
      ...current,
      country: resolveBrowserCountry(locale),
    }));
  }, [locale]);

  const passwordPolicy = getPasswordPolicyState(state.password);
  const passwordHint =
    state.password.length > 0 && passwordPolicy.isValid
      ? t("passwordReady")
      : t("passwordHint");
  const passwordHintTone = useMemo(
    () =>
      state.password.length === 0
        ? ("default" as const)
        : passwordPolicy.isValid
          ? ("success" as const)
          : ("warning" as const),
    [passwordPolicy.isValid, state.password.length],
  );

  const updateState = <Key extends keyof RegisterFormState>(
    key: Key,
    value: RegisterFormState[Key],
  ) => {
    setError(null);
    setState((current) => ({ ...current, [key]: value }));
  };

  const goToStep = (nextStep: RegisterStep) => {
    setDirection(
      getRegisterStepIndex(nextStep) > getRegisterStepIndex(step) ? 1 : -1,
    );
    setError(null);
    setStep(nextStep);
  };

  const handleInviteNext = async () => {
    const normalizedInviteCode = state.inviteCode.trim().toUpperCase();
    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      setError(t("serviceUnavailable"));
      return;
    }

    setCheckingInvite(true);
    setError(null);

    try {
      const context = await getSignupInviteContext(
        supabase,
        normalizedInviteCode,
      );

      if (typeof context === "string") {
        if (context === "unavailable") {
          setError(t("serviceUnavailable"));
        } else {
          setError(formatReferralCodeStatus(context, t));
        }
        return;
      }

      setInviteContext(context);
      setState((current) => ({
        ...current,
        business: context.suggestedBusinessKey ?? current.business,
        inviteCode: normalizedInviteCode,
      }));
      goToStep(getNextRegisterStep("invite"));
    } catch (inviteError) {
      setError(formatAuthError(inviteError, t));
    } finally {
      setCheckingInvite(false);
    }
  };

  const handleBusinessNext = () => {
    if (!state.business) {
      setError(t("businessRequired"));
      return;
    }

    goToStep(getNextRegisterStep("business"));
  };

  const handleProfileNext = () => {
    if (!state.name.trim() || !state.email.trim()) {
      setError(t("profileRequired"));
      return;
    }

    if (!isValidEmail(state.email)) {
      setError(t("invalidEmail"));
      return;
    }

    if (
      normalizeInternationalPhone(state.country, state.phoneNational) ===
      undefined
    ) {
      setError(t("invalidPhone"));
      return;
    }

    goToStep(getNextRegisterStep("profile"));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!state.acceptedTerms) {
      setError(t("acceptTerms"));
      return;
    }

    if (!passwordPolicy.isValid) {
      setError(t("passwordPolicy"));
      return;
    }

    if (!state.business) {
      goToStep(hasBusinessSelectionStep() ? "business" : "invite");
      setError(t("businessRequired"));
      return;
    }

    const normalizedPhone = normalizeInternationalPhone(
      state.country,
      state.phoneNational,
    );

    if (normalizedPhone === undefined) {
      goToStep("profile");
      setError(t("invalidPhone"));
      return;
    }

    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      setError(t("serviceUnavailable"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const normalizedInviteCode = state.inviteCode.trim().toUpperCase();
      const latestInviteContext = await getSignupInviteContext(
        supabase,
        normalizedInviteCode,
      );

      if (typeof latestInviteContext === "string") {
        goToStep("invite");
        setError(
          latestInviteContext === "unavailable"
            ? t("serviceUnavailable")
            : formatReferralCodeStatus(latestInviteContext, t),
        );
        return;
      }

      if (
        latestInviteContext.locksBusiness &&
        latestInviteContext.suggestedBusinessKey !== state.business
      ) {
        goToStep(hasBusinessSelectionStep() ? "business" : "invite");
        setError(t("businessLockedError"));
        return;
      }

      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : undefined;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: state.email.trim(),
        password: state.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            business_board: state.business,
            name: state.name.trim(),
            phone: normalizedPhone,
            referral_code: normalizedInviteCode || null,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      requireAuthUserReceipt(data, {
        errorMessage: "registration_receipt_invalid",
        expectedEmail: state.email,
      });

      if (isRegisteredEmailSignupResult(data)) {
        setError(t("userExists"));
        return;
      }

      if (data.session?.user) {
        const role = await getRoleFromAuthClaims(supabase, data.session.user);
        const businesses = await getCurrentWorkspaceBusinessAccess(supabase);
        const nextPath = role
          ? getSignedInWorkspaceDestination(role, businesses)
          : "/";

        startTransition(() => router.replace(nextPath));
        return;
      }

      startTransition(() => router.replace("/login?registered=1"));
    } catch (signUpError) {
      setError(formatAuthError(signUpError, t));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    checkingInvite,
    direction,
    error,
    handleBusinessNext,
    handleInviteNext,
    handleProfileNext,
    handleSubmit,
    inviteContext,
    passwordHint,
    passwordHintTone,
    setBusiness: (business: SignupBusiness) =>
      updateState("business", business),
    setCountry: (country: CountryCode) => updateState("country", country),
    setEmail: (email: string) => updateState("email", email),
    setInviteCode: (inviteCode: string) => {
      setInviteContext({
        locksBusiness: false,
        status: "optional",
        suggestedBusinessKey: null,
      });
      updateState("inviteCode", inviteCode);
    },
    setName: (name: string) => updateState("name", name),
    setPassword: (password: string) => updateState("password", password),
    setPhoneNational: (phone: string) => updateState("phoneNational", phone),
    setTermsAccepted: (accepted: boolean) =>
      updateState("acceptedTerms", accepted),
    state,
    step,
    submitting,
    toPreviousStep: () => goToStep(getPreviousRegisterStep(step)),
  };
}

function normalizeInitialInviteCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
