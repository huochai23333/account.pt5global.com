import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import type { RegisterStep } from "./register-form-types";
import { getRegisterStepIndex, registerSteps } from "./register-flow";

export function RegisterWizardProgress({ step }: { step: RegisterStep }) {
  const t = useTranslations("RegisterForm");
  // 单一业务会跳过业务步骤；圆点与连线都按实际步骤索引判断，不能比较英文名称。
  const currentStepIndex = getRegisterStepIndex(step);

  return (
    <div aria-label={t("progressLabel")} className="mb-7">
      <div className="flex items-center gap-2" role="list">
        {registerSteps.map((item, index) => {
          const completed = index < currentStepIndex;
          return (
            <div className="contents" key={item}>
              <div
                aria-current={item === step ? "step" : undefined}
                className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                  completed
                    ? "border-primary bg-primary text-primary-foreground"
                    : item === step
                      ? "border-primary bg-status-info-soft text-primary"
                      : "border-border bg-surface-interactive text-content-subtle"
                }`}
                role="listitem"
              >
                {completed ? <Check className="size-4" /> : index + 1}
              </div>
              {index < registerSteps.length - 1 ? (
                <span
                  aria-hidden
                  className={`h-0.5 min-w-0 flex-1 rounded-full transition-colors ${
                    completed ? "bg-primary" : "bg-border"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm font-semibold text-primary">
        {t(`steps.${step}.title`)}
      </p>
      <p className="mt-1 text-sm leading-6 text-content-muted">
        {t(`steps.${step}.description`)}
      </p>
    </div>
  );
}
