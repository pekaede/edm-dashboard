import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useLocale } from "../i18n";
import { getTheme, setTheme } from "../theme";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const { t } = useLocale();
  const [theme, updateTheme] = useState(getTheme);
  const next = theme === "dark" ? "light" : "dark";
  const label = t(next === "dark" ? "appearanceSwitchDark" : "appearanceSwitchLight");
  const Icon = next === "dark" ? Moon : Sun;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full"
      aria-label={label}
      onClick={() => {
        setTheme(next);
        updateTheme(next);
      }}
    >
      <Icon aria-hidden="true" />
      {label}
    </Button>
  );
}
