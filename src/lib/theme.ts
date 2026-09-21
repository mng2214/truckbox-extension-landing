export type LandingTheme = "light" | "dark";

const KEY = "tb-landing-theme";
export const THEME_EVENT = "tb-landing-theme";

const isLandingPath = (path: string) => !path.startsWith("/business");
const isSignupPath = (path: string) =>
  ["/business/request", "/business/invite", "/business/start"].some((p) => path.startsWith(p));

export function getLandingTheme(): LandingTheme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyLandingTheme(path: string = location.pathname): void {
  document.documentElement.classList.toggle(
    "tb-light",
    isSignupPath(path) || (isLandingPath(path) && getLandingTheme() === "light")
  );
}

export function setLandingTheme(theme: LandingTheme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked — applies for this page view only */
  }
  applyLandingTheme();
  window.dispatchEvent(new Event(THEME_EVENT));
}
