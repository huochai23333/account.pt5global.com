import type { InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";

import { Eye, EyeOff, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";

type AuthPasswordFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  hidePasswordLabel: string;
  hint?: string;
  hintTone?: "default" | "success" | "warning";
  label: string;
  labelAction?: ReactNode;
  showPasswordLabel: string;
};

export function AuthPasswordField({
  className,
  disabled,
  hidePasswordLabel,
  hint,
  hintTone = "default",
  label,
  labelAction,
  showPasswordLabel,
  ...props
}: AuthPasswordFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const toggleLabel = isPasswordVisible ? hidePasswordLabel : showPasswordLabel;

  return (
    <Field
      hint={hint}
      hintTone={hintTone === "default" ? "neutral" : hintTone}
      label={label}
      labelAction={labelAction}
      required={props.required}
    >
      <span className="group relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-4 text-content-subtle transition-colors group-focus-within:text-primary">
          <LockKeyhole className="size-4" />
        </span>
        <Input
          className={className}
          controlSize="large"
          disabled={disabled}
          type={isPasswordVisible ? "text" : "password"}
          {...props}
          style={{ paddingLeft: "3rem", paddingRight: "3rem", ...props.style }}
        />
        <Button
          aria-label={toggleLabel}
          // aria-pressed 让键盘及读屏用户知道密码目前是否可见。
          aria-pressed={isPasswordVisible}
          className="absolute inset-y-0 right-0 rounded-l-none rounded-r-[22px] text-content-muted"
          disabled={disabled}
          onClick={() => setIsPasswordVisible((current) => !current)}
          size="icon-large"
          type="button"
          variant="ghost"
        >
          {isPasswordVisible ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </Button>
      </span>
    </Field>
  );
}
