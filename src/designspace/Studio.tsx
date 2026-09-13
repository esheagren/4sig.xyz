import { useEffect, useRef, useState } from "react";
import { components, screens, screenById, type Screen } from "./catalog";
import styles from "./studio.css?inline";
const css = document.createElement("style");
css.textContent = styles;
document.head.append(css);
const groups = [...new Set(screens.map((s) => s.group))];
const sizes = [
  ["Small phone", 320, 568],
  ["Phone", 390, 844],
  ["Large phone", 430, 932],
  ["Tablet", 768, 1024],
  ["Desktop", 1280, 900],
] as const;
const frameUrl = (id: string) =>
  "/designspace?view=screen&screen=" + encodeURIComponent(id);
function locationState() {
  const q = new URLSearchParams(location.hash.slice(1));
  return {
    screen: screenById(q.get("screen")),
    view: ["screens", "flow", "components"].includes(q.get("view") ?? "")
      ? q.get("view")!
      : "screens",
    gallery: q.get("gallery") === "1",
    component: q.get("component") ?? "",
    size: Number(q.get("size") ?? 1),
  };
}
export default function Studio() {
  const [initial] = useState(locationState),
    [selected, setSelected] = useState(initial.screen),
    [view, setView] = useState(initial.view),
    [component, setComponent] = useState(initial.component),
    [size, setSize] = useState(
      initial.size >= 0 && initial.size < sizes.length ? initial.size : 1,
    ),
    [search, setSearch] = useState(""),
    [gallery, setGallery] = useState(initial.gallery),
    [revision, setRevision] = useState(0),
    [inspect, setInspect] = useState(false),
    [status, setStatus] = useState(""),
    [fit, setFit] = useState(true),
    [showDetails, setShowDetails] = useState(false),
    [available, setAvailable] = useState({ width: 800, height: 800 });
  const frame = useRef<HTMLIFrameElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const [label, width, height] = sizes[size],
    scale = fit
      ? Math.max(
          0.1,
          Math.min(
            1,
            (available.width - 24) / width,
            (available.height - 60) / height,
          ),
        )
      : 1;
  const filtered = screens.filter((s) =>
    (
      s.code +
      " " +
      s.name +
      " " +
      s.group +
      " " +
      s.components
        .map((id) => components.find((c) => c.id === id)?.name)
        .join(" ")
    )
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const detail = components.find((c) => c.id === component);
  const navigate = (next: Screen) => {
    setSelected(next);
    setRevision((r) => r + 1);
    setInspect(false);
  };
  useEffect(() => {
    const params = new URLSearchParams({
      view,
      screen: selected.id,
      size: String(size),
    });
    if (component) params.set("component", component);
    if (gallery) params.set("gallery", "1");
    history.replaceState(null, "", "#" + params.toString());
  }, [view, selected, size, component, gallery]);
  useEffect(() => {
    const restore = () => {
      const next = locationState();
      setSelected(next.screen);
      setView(next.view);
      setGallery(next.gallery);
      setComponent(next.component);
      setSize(next.size >= 0 && next.size < sizes.length ? next.size : 1);
      setRevision((r) => r + 1);
    };
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const resize = new ResizeObserver(([entry]) =>
      setAvailable({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    resize.observe(node);
    return () => resize.disconnect();
  }, [view, gallery]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { type: "design-inspect", enabled: inspect },
      location.origin,
    );
  }, [inspect]);
  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.type !== "design-component"
      )
        return;
      if (components.some((c) => c.id === event.data.id)) {
        setComponent(event.data.id);
        setInspect(false);
      }
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 2500);
    return () => clearTimeout(timer);
  }, [status]);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      setStatus("View link copied.");
    } catch {
      setStatus("Copy this view’s URL from the address bar.");
    }
  }
  const openScreen = (screen: Screen) => {
    navigate(screen);
    setView("screens");
    setGallery(false);
    setComponent("");
  };
  return (
    <div className="ds-shell">
      <header className="ds-header">
        <a
          className="ds-brand"
          href="/designspace"
          aria-label="4σ design space"
        >
          4<span>σ</span>
          <small>Design space</small>
        </a>
        <div className="ds-tabs" role="tablist" aria-label="Design workspace">
          {[
            ["screens", "Screens", screens.length],
            ["flow", "Journeys", 3],
            ["components", "Components", components.length],
          ].map(([id, name, count]) => (
            <button
              key={id}
              role="tab"
              id={"tab-" + id}
              aria-selected={view === id}
              aria-controls="workspace"
              onClick={() => {
                setView(String(id));
                setComponent("");
              }}
            >
              {name}
              <small>{count}</small>
            </button>
          ))}
        </div>
        <div className="ds-tab-actions">
          <button onClick={copyLink}>Copy link</button>
          <details className="ds-resources">
            <summary>Resources</summary>
            <nav aria-label="Design resources">
              <a href="/designspace?view=questions">Question library ↗</a>
              <a href="/designspace?view=scorecards">Ink collection ↗</a>
              <a href="/designspace?view=archive">Earlier explorations ↗</a>
              <a href="/" target="_blank" rel="noreferrer">
                Live game ↗
              </a>
              <span className="ds-sample">
                <i /> Sample data
              </span>
              <form action="/designspace" method="post">
                <input type="hidden" name="action" value="logout" />
                <button>Sign out</button>
              </form>
            </nav>
          </details>
          <span role="status">{status}</span>
        </div>
      </header>
      <main id="workspace" role="tabpanel" aria-labelledby={"tab-" + view}>
        {view === "flow" ? (
          <section className="ds-journeys">
            <div className="ds-section-heading">
              <h2>The three journeys.</h2>
              <p>Select any step to open its live preview.</p>
            </div>
            {[
              {
                name: "01 · A first visit",
                note: "Welcome → practice → explanation → eight questions → a personal scorecard.",
                ids: [
                  "welcome",
                  "practice-estimate",
                  "practice-range",
                  "practice-answer",
                  "scoring",
                  "worldview",
                  "setup",
                  "calibration-estimate",
                  "claim",
                  "starting-score",
                ],
              },
              {
                name: "02 · Every new day",
                note: "A returning player opens the first daily question directly. The tutorial stays behind them.",
                ids: ["daily-estimate", "range", "answer-hit", "daily-score"],
              },
              {
                name: "03 · Your information",
                note: "Open the three-bar menu from the thin bottom bar. Switch tabs without leaving the game.",
                ids: [
                  "menu-stats",
                  "menu-profile",
                  "menu-settings",
                  "menu-play",
                ],
              },
            ].map((flow) => (
              <article className="ds-journey" key={flow.name}>
                <h3>{flow.name}</h3>
                <p>{flow.note}</p>
                <ol>
                  {flow.ids.map((id, i) => {
                    const s = screenById(id);
                    return (
                      <li key={id}>
                        <button onClick={() => openScreen(s)}>
                          <span>{s.code}</span>
                          <strong>{s.name}</strong>
                        </button>
                        {i < flow.ids.length - 1 && <b aria-hidden="true">→</b>}
                      </li>
                    );
                  })}
                </ol>
                {flow.name.startsWith("02") && (
                  <p className="ds-flow-note">
                    Estimate → range → reveal repeats four times. Each answer
                    appears immediately. New editions begin at midnight Pacific.
                  </p>
                )}
              </article>
            ))}
            <div className="ds-principles">
              <h3>Decisions to keep in view</h3>
              <p>
                Eight starting questions. Four shared daily questions. A fixed
                estimate between movable bounds. Half a second to submit. A GIF
                scorecard and the homepage URL when sharing.
              </p>
            </div>
          </section>
        ) : (
          <>
            <div
              className={
                "ds-workbench" + (showDetails ? " ds-show-details" : "")
              }
            >
              <aside className="ds-library">
                <label className="ds-search">
                  <span className="ds-sr">Find a screen or component</span>
                  <input
                    type="search"
                    placeholder="Search names…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                {view === "components" ? (
                  <div className="ds-component-list">
                    {components
                      .filter((c) =>
                        (c.name + " " + c.source)
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((c) => (
                        <button
                          key={c.id}
                          aria-current={component === c.id ? "true" : undefined}
                          onClick={() => {
                            setComponent(c.id);
                            navigate(screenById(c.screen));
                          }}
                        >
                          <strong>{c.name}</strong>
                          <small>{c.source}</small>
                        </button>
                      ))}
                  </div>
                ) : (
                  groups.map((group) => (
                    <section className="ds-group" key={group}>
                      <h2>{group}</h2>
                      {filtered
                        .filter((s) => s.group === group)
                        .map((s) => (
                          <button
                            key={s.id}
                            aria-current={
                              selected.id === s.id ? "page" : undefined
                            }
                            onClick={() => {
                              navigate(s);
                              setComponent("");
                            }}
                          >
                            <span>{s.code}</span>
                            {s.name}
                          </button>
                        ))}
                    </section>
                  ))
                )}
                {(view === "components"
                  ? components.filter((c) =>
                      (c.name + " " + c.source)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    ).length === 0
                  : filtered.length === 0) && (
                  <p className="ds-empty">
                    No matches. Try “range”, “score”, or “menu”.
                  </p>
                )}
                <a className="ds-archive" href="/designspace?view=archive">
                  Earlier visual explorations ↗
                </a>
              </aside>
              <section className="ds-canvas">
                <div className="ds-canvas-bar">
                  <div>
                    <span className="ds-code">{selected.code}</span>
                    <h2>{detail?.name ?? selected.name}</h2>
                  </div>
                  <div className="ds-tools">
                    <button
                      className="ds-details-toggle"
                      aria-pressed={showDetails}
                      aria-controls="screen-details"
                      onClick={() => setShowDetails(!showDetails)}
                    >
                      Details
                    </button>
                    {view === "screens" && (
                      <button
                        aria-pressed={gallery}
                        onClick={() => setGallery(!gallery)}
                      >
                        {gallery ? "Single screen" : "All screens"}
                      </button>
                    )}
                    <label>
                      <span className="ds-sr">Preview size</span>
                      <select
                        disabled={gallery && view === "screens"}
                        value={size}
                        onChange={(e) => setSize(Number(e.target.value))}
                      >
                        {sizes.map(([name, w], i) => (
                          <option key={name} value={i}>
                            {name} · {w}px
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={gallery && view === "screens"}
                      aria-pressed={fit}
                      onClick={() => setFit(!fit)}
                    >
                      {fit ? "Fit" : "100%"}
                    </button>
                    <button
                      onClick={() => {
                        setRevision((r) => r + 1);
                        setInspect(false);
                        setGallery(false);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
                {gallery && view === "screens" ? (
                  <div className="ds-gallery">
                    {filtered.map((s) => (
                      <article key={s.id}>
                        <button
                          className="ds-gallery-title"
                          onClick={() => openScreen(s)}
                        >
                          <span>{s.code}</span>
                          <strong>{s.name}</strong>
                          <b>↗</b>
                        </button>
                        <div className="ds-thumbnail">
                          <iframe
                            loading="lazy"
                            title={s.code + " " + s.name + " overview"}
                            sandbox="allow-scripts allow-same-origin"
                            src={frameUrl(s.id)}
                            tabIndex={-1}
                          />
                          <button
                            aria-label={"Open " + s.name}
                            onClick={() => openScreen(s)}
                          />
                        </div>
                        <p>{s.description}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="ds-stage" ref={stage}>
                    <div className="ds-device-label">
                      {label}{" "}
                      <span>
                        {width} × {height} · {Math.round(scale * 100)}%
                      </span>
                    </div>
                    <div
                      className="ds-device-space"
                      style={{ width: width * scale, height: height * scale }}
                    >
                      <iframe
                        ref={frame}
                        key={selected.id + "-" + revision}
                        className="ds-device"
                        title={
                          selected.code +
                          " " +
                          selected.name +
                          " interactive preview"
                        }
                        src={frameUrl(selected.id)}
                        style={{ width, height, transform: `scale(${scale})` }}
                        allow="clipboard-write"
                        sandbox="allow-scripts allow-same-origin"
                        onLoad={() =>
                          frame.current?.contentWindow?.postMessage(
                            { type: "design-inspect", enabled: inspect },
                            location.origin,
                          )
                        }
                      />
                    </div>
                    <p className="ds-stage-help">
                      Interact inside the preview. Reset returns to this named
                      state.
                    </p>
                  </div>
                )}
              </section>
              <aside className="ds-inspector" id="screen-details">
                <p className="ds-eyebrow">
                  {detail ? "Component reference" : "Screen reference"}
                </p>
                <h2>{detail?.name ?? selected.name}</h2>
                {detail && <code>{detail.source}</code>}
                <p>{detail?.description ?? selected.description}</p>
                <div className="ds-try">
                  <h3>Try it</h3>
                  <p>{selected.try}</p>
                </div>
                <button
                  className="ds-inspect-button"
                  disabled={gallery && view === "screens"}
                  aria-pressed={inspect}
                  onClick={() => setInspect(!inspect)}
                >
                  {inspect ? "Stop inspecting" : "Inspect component names"}
                </button>
                <p className="ds-small">
                  Inspect, then click a part of the preview to identify it.
                </p>
                <h3>On this screen</h3>
                <ul className="ds-component-chips">
                  {selected.components.map((id) => {
                    const c = components.find((c) => c.id === id)!;
                    return (
                      <li key={id}>
                        <button
                          aria-pressed={component === id}
                          onClick={() => setComponent(id)}
                        >
                          {c.name}
                          <span>↗</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {detail && (
                  <>
                    <h3>Used on</h3>
                    <ul className="ds-used">
                      {screens
                        .filter((s) => s.components.includes(detail.id))
                        .map((s) => (
                          <li key={s.id}>
                            <button
                              onClick={() => {
                                navigate(s);
                                setComponent(detail.id);
                              }}
                            >
                              {s.code} · {s.name}
                            </button>
                          </li>
                        ))}
                    </ul>
                  </>
                )}
                <a
                  className="ds-open"
                  href={frameUrl(selected.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open full-size preview ↗
                </a>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
