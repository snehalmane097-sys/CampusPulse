"use client";
import { useEffect, useState } from "react";
import { resolveTheme, type Theme } from "@/lib/theme";
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => { let saved = null; try { saved = localStorage.getItem("cp_theme"); } catch {} const next = resolveTheme(saved, media.matches); document.documentElement.dataset.theme = next; setTheme(next); };
    sync(); media.addEventListener("change", sync); window.addEventListener("storage", sync);
    return () => { media.removeEventListener("change", sync); window.removeEventListener("storage", sync); };
  }, []);
  return <button type="button" className="cp-secondary" aria-label="Dark theme" aria-pressed={theme === "dark"} onClick={() => { const next = theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; setTheme(next); try { localStorage.setItem("cp_theme", next); } catch {} }}><span aria-hidden="true">{theme === "dark" ? "\u263e" : "\u2600"}</span><span>{theme === "dark" ? "Dark" : "Light"}</span></button>;
}
