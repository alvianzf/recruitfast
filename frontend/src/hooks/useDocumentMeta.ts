import { useEffect } from "react";

// Sets the browser tab title and <meta name="description"> per page.
// Client-side only, so it does not help a social-media crawler (those
// don't run JS against this SPA) — that's what the backend's
// GET /public/jobs/{slug}/share preview page is for. This is for the
// browser tab, search-result snippets on pages Google does render, and
// basic on-page SEO hygiene.
export function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    let meta: HTMLMetaElement | null = null;
    let previousDescription: string | null = null;
    if (description) {
      meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      previousDescription = meta.getAttribute("content");
      meta.setAttribute("content", description);
    }

    return () => {
      document.title = previousTitle;
      if (meta && previousDescription !== null) {
        meta.setAttribute("content", previousDescription);
      }
    };
  }, [title, description]);
}
