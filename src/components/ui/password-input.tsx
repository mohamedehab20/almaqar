"use client";

import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "./input";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "icon" | "endSlot">;

export function PasswordInput(props: PasswordInputProps) {
  const t = useTranslations("auth.common");
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      icon={LockKeyhole}
      endSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-container hover:text-on-surface"
        >
          <ToggleIcon className="size-5" aria-hidden />
        </button>
      }
    />
  );
}
