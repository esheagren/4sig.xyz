import { lazy, Suspense, useRef, useState } from "react";
import Questions from "./Questions";
import Analytics from "./Analytics";
import styles from "./admin.css?inline";
const css = document.createElement("style");
css.textContent = styles;
document.head.append(css);
const Studio = lazy(() => import("../designspace/Studio"));
export default function AdminApp() {
  const [tab, setTab] = useState(() => {
    const view = new URLSearchParams(location.search).get("view");
    return view && ["analytics", "questions", "design"].includes(view)
      ? view
      : "analytics";
  });
  const [visited, setVisited] = useState(() => new Set([tab]));
  const designHash = useRef(location.hash);
  const navigate = (view: string) => {
    if (tab === "design") designHash.current = location.hash;
    setVisited((v) => new Set([...v, view]));
    setTab(view);
    history.replaceState(
      null,
      "",
      "/admin?view=" + view + (view === "design" ? designHash.current : ""),
    );
  };
  return (
    <div className="ad-app">
      <header className="ad-header">
        <a className="ad-brand" href="/admin">
          4σ <span>Admin</span>
        </a>
        <nav aria-label="Admin sections">
          {["analytics", "questions", "design"].map((view) => (
            <button
              key={view}
              onClick={() => navigate(view)}
              aria-current={tab === view ? "page" : undefined}
            >
              {view[0].toUpperCase() + view.slice(1)}
            </button>
          ))}
        </nav>
        <a className="ad-live" href="/" target="_blank" rel="noreferrer">
          Open game ↗
        </a>
        <form method="post" action="/admin">
          <input type="hidden" name="action" value="logout" />
          <button>Sign out</button>
        </form>
      </header>
      <main className="ad-main">
        <section hidden={tab !== "analytics"}>
          {visited.has("analytics") && <Analytics />}
        </section>
        <section hidden={tab !== "questions"}>
          {visited.has("questions") && <Questions />}
        </section>
        <section className="ad-design" hidden={tab !== "design"}>
          {visited.has("design") && (
            <Suspense fallback={<p className="ad-loading">Opening design…</p>}>
              <Studio />
            </Suspense>
          )}
        </section>
      </main>
    </div>
  );
}
