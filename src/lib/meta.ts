import { useEffect } from "react";

type PageMeta = {
  title: string;
  description: string;
  /** Path for the canonical URL, e.g. "/guide". Defaults to current pathname. */
  path?: string;
  /** Set true on app/service routes that must not be indexed. */
  noindex?: boolean;
};

const ORIGIN = "https://truckbox.app";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Route-level SEO: title, description, canonical, robots and OG/Twitter mirrors.
    Runs on mount; the prerender snapshot captures the resolved tags per route. */
export function usePageMeta({ title, description, path, noindex }: PageMeta) {
  useEffect(() => {
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);

    const canonicalPath = path ?? window.location.pathname;
    const canonical = canonicalPath === "/" ? `${ORIGIN}/` : `${ORIGIN}${canonicalPath}`;
    upsertCanonical(canonical);
    upsertMeta("property", "og:url", canonical);

    upsertMeta(
      "name",
      "robots",
      noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"
    );
  }, [title, description, path, noindex]);
}
