export type Theme = "light" | "dark";
export function resolveTheme(saved: string | null, prefersDark: boolean): Theme {
  return saved === "light" || saved === "dark" ? saved : prefersDark ? "dark" : "light";
}
export const THEME_INIT = `(function(){var s;try{s=localStorage.getItem('cp_theme')}catch(e){}document.documentElement.dataset.theme=(s==='light'||s==='dark')?s:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`;
