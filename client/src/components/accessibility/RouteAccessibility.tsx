import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

function routeFallbackLabel(route: string): string {
  const segments = route.split("/").filter(Boolean).filter((segment) => !/^\d+$/.test(segment));
  const lastSegment = segments.at(-1) ?? "Home";
  return lastSegment
    .replace(/[-_]+/g, " ")
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function getPageLabel(main: HTMLElement | null, route: string): string {
  const heading = main?.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
  return heading || routeFallbackLabel(route);
}

export function RouteAccessibility() {
  const [location] = useLocation();
  const route = location.split(/[?#]/, 1)[0] || "/";
  const previousRoute = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const isInitialRoute = previousRoute.current === null;
    previousRoute.current = route;
    setAnnouncement("");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    let announcementTimer: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      const main = document.getElementById("main-content");
      if (!isInitialRoute) {
        main?.focus({ preventScroll: true });
      }

      announcementTimer = window.setTimeout(() => {
        setAnnouncement(`Page loaded: ${getPageLabel(main, route)}`);
      }, 50);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (announcementTimer !== undefined) {
        window.clearTimeout(announcementTimer);
      }
    };
  }, [route]);

  return (
    <span className="sr-only" aria-live="polite" aria-atomic="true" data-testid="route-announcer">
      {announcement}
    </span>
  );
}
