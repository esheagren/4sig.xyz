import { useEffect, useRef, useState } from "react";
import { adminRequest, num, time } from "./api";
type Person = {
  subject: string;
  username: string | null;
  runs: number;
  answers: number;
  completed: number;
  last_seen: string;
  excluded: boolean;
};
type Visit = {
  id: string;
  browser_id: string;
  username: string | null;
  started: string;
  last_seen: string;
  screen: string | null;
  device: string;
  browser: string;
  excluded: boolean;
};
type Dashboard = {
  days: number;
  tracking: string | null;
  metrics: {
    opened: number;
    players: number;
    started: number;
    completed: number;
    stalled: number;
    legacy: number;
    returning: number;
  };
  activity: { day: string; opened: number; completed: number }[];
  progress: { position: number; reached: number }[];
  screens: { screen: string; visits: number; seconds: number | null }[];
  lastScreens: { screen: string; visits: number }[];
  visitMetrics: {
    visits: number;
    browsers: number;
    claims: number;
    copies: number;
  };
  funnel: Record<string, number>;
  problems: {
    name: string;
    action: string | null;
    outcome: string | null;
    status: string | null;
    count: number;
  }[];
  devices: {
    device: string;
    browser: string;
    visits: number;
    completed: number;
  }[];
  questions: {
    id: string;
    prompt: string;
    offered: number;
    answered: number;
    score: number | null;
    hit: number | null;
    stalled: number;
  }[];
  people: Person[];
  recentVisits: Visit[];
};
type Answer = {
  position: number;
  prompt: string;
  truth: number;
  unit: string;
  estimate: number | null;
  lower: number | null;
  upper: number | null;
  score: number | null;
  hit: boolean | null;
  answeredAt: string | null;
};
type Detail = {
  subject: string;
  games: {
    id: string;
    edition: string;
    kind: string;
    created_at: string;
    completed_at: string | null;
    is_ranked: boolean;
    username: string | null;
    answers: Answer[];
  }[];
  events: {
    id: string;
    name: string;
    screen: string | null;
    properties: {
      outcome?: string;
      status?: number;
      activeMs?: number;
      action?: string;
    };
    created_at: string;
    device: string;
    browser: string;
    visit_id: string;
    visitor_id: string;
    session_id: string | null;
  }[];
};
const screenName = (s: string) =>
  s.replaceAll("-", " ").replace(/^./, (c) => c.toUpperCase());
const pct = (a: number, b: number) =>
  b ? `${Math.round((100 * a) / b)}%` : "—";
export default function Analytics() {
  const [data, setData] = useState<Dashboard | null>(null),
    [days, setDays] = useState(30),
    [tests, setTests] = useState(false),
    [reload, setReload] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [tab, setTab] = useState("overview"),
    [search, setSearch] = useState("");
  const [subject, setSubject] = useState(""),
    [detail, setDetail] = useState<Detail | null>(null),
    [detailError, setDetailError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void adminRequest<Dashboard>(
      `analytics&days=${days}&tests=${tests ? 1 : 0}`,
    )
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days, tests, reload]);
  useEffect(() => {
    if (!subject) return;
    let active = true;
    setDetail(null);
    setDetailError("");
    void adminRequest<Detail>("person&subject=" + encodeURIComponent(subject))
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((e) => {
        if (active) setDetailError(e.message);
      });
    return () => {
      active = false;
    };
  }, [subject]);
  const modal = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (subject) modal.current?.showModal();
  }, [subject]);
  async function exclude(subject: string, excluded: boolean) {
    try {
      await adminRequest("exclude", {
        subject,
        excluded,
        reason: "Internal testing",
      });
      setReload((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="ad-analytics">
      <div className="ad-toolbar">
        <div className="ad-segment">
          {["overview", "journeys", "questions", "people"].map((v) => (
            <button key={v} aria-pressed={tab === v} onClick={() => setTab(v)}>
              {screenName(v)}
            </button>
          ))}
        </div>
        <select
          aria-label="Analytics period"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {[7, 30, 90].map((n) => (
            <option key={n} value={n}>
              Last {n} days
            </option>
          ))}
        </select>
        <label className="ad-check">
          <input
            type="checkbox"
            checked={tests}
            onChange={(e) => setTests(e.target.checked)}
          />
          Include tests
        </label>
        <button disabled={loading} onClick={() => setReload((n) => n + 1)}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error && (
        <p className="ad-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <p className="ad-loading">
          {error
            ? "Analytics unavailable."
            : "Loading saved games and journeys…"}
        </p>
      ) : (
        <>
          <div className="ad-coverage">
            <strong>Saved games</strong> Historical records available.{" "}
            <strong>Screen journeys</strong>{" "}
            {data.tracking
              ? `Tracking since ${time(data.tracking)}.`
              : "Tracking starts with this release."}{" "}
            Earlier screen exits and timings cannot be reconstructed.
          </div>
          {tab === "overview" && (
            <>
              <div className="ad-metrics">
                {[
                  [
                    "Players",
                    num(data.metrics.players),
                    "Distinct saved-game owners",
                  ],
                  [
                    "Started",
                    num(data.metrics.started),
                    `Of ${num(data.metrics.opened)} runs opened`,
                  ],
                  [
                    "Finished",
                    num(data.metrics.completed),
                    `${pct(data.metrics.completed, data.metrics.started)} of runs with an answer`,
                  ],
                  [
                    "Returned",
                    num(data.metrics.returning),
                    "Finished on 2+ daily editions",
                  ],
                ].map(([label, value, note]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{note}</small>
                  </div>
                ))}
              </div>
              <p className="ad-note">
                Ranked runs opened in this period; a run is created when the
                game loads. {num(data.metrics.legacy)} legacy starting runs
                included. {num(data.metrics.stalled)} incomplete runs have no
                submitted answer in the last 30 minutes; that alone does not
                prove someone left.
              </p>
              <div className="ad-panels">
                <section className="ad-panel">
                  <h2>Daily activity</h2>
                  <p className="ad-note">
                    Runs opened that day, and how many have since finished.
                    Pacific time.
                  </p>
                  {data.activity.length ? (
                    <div
                      className="ad-chart"
                      role="img"
                      aria-label="Daily opened and completed game counts"
                    >
                      {data.activity.map((d) => (
                        <div
                          key={d.day}
                          title={`${d.day}: ${d.opened} opened, ${d.completed} finished`}
                        >
                          <div className="ad-chart-bars">
                            <i
                              style={{
                                height: `${(100 * d.opened) / Math.max(1, ...data.activity.map((v) => v.opened))}%`,
                              }}
                            />
                            <b
                              style={{
                                height: `${(100 * d.completed) / Math.max(1, ...data.activity.map((v) => v.opened))}%`,
                              }}
                            />
                          </div>
                          <small>{d.day.slice(5)}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty />
                  )}
                  <p className="ad-legend">
                    ■ Opened <span>■ Finished</span>
                  </p>
                </section>
                <section className="ad-panel">
                  <h2>Five-question progress</h2>
                  <p className="ad-note">
                    Same cohort of five-question daily runs. Counts reflect
                    saved answers.
                  </p>
                  {data.progress.map((p, i) => (
                    <Bar
                      key={p.position}
                      label={
                        p.position ? `${p.position} answered` : "Run opened"
                      }
                      value={p.reached}
                      total={data.progress[0]?.reached ?? 0}
                      extra={
                        i > 0
                          ? `${data.progress[i - 1].reached - p.reached} fewer than previous`
                          : undefined
                      }
                    />
                  ))}
                  {!data.progress.length && <Empty />}
                </section>
                <section className="ad-panel">
                  <h2>Newly tracked visits</h2>
                  <div className="ad-mini-metrics">
                    <div>
                      <strong>{num(data.visitMetrics.visits)}</strong>Visits
                    </div>
                    <div>
                      <strong>{num(data.visitMetrics.browsers)}</strong>Browsers
                    </div>
                    <div>
                      <strong>{num(data.visitMetrics.claims)}</strong>Claimed a
                      name
                    </div>
                    <div>
                      <strong>{num(data.visitMetrics.copies)}</strong>Copied
                    </div>
                  </div>
                  <p className="ad-note">
                    A visit resets after 30 minutes of inactivity. Copy success
                    confirms clipboard access, not delivery to someone else.
                  </p>
                </section>
                <section className="ad-panel">
                  <h2>Browser & device</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Segment</th>
                        <th>Visits</th>
                        <th>Saw results</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.devices.map((d) => (
                        <tr key={d.device + d.browser}>
                          <td>
                            {d.device} · {d.browser}
                          </td>
                          <td>{d.visits}</td>
                          <td>{pct(d.completed, d.visits)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.devices.length && <Empty />}
                </section>
              </div>
            </>
          )}
          {tab === "journeys" && (
            <div className="ad-panels">
              <section className="ad-panel">
                <h2>First-visit path</h2>
                <p className="ad-note">
                  Visits that saw Welcome, then reached each step in this order
                  within that visit. Resumed visits are outside this cohort.
                </p>
                {Object.entries({
                  welcome: "Welcome",
                  topics: "What we cover",
                  claimed: "Username claimed",
                  answered: "First daily answer revealed",
                  complete: "Scorecard",
                  copied: "Copied",
                }).map(([key, label]) => (
                  <Bar
                    key={key}
                    label={label}
                    value={data.funnel[key] ?? 0}
                    total={data.funnel.welcome ?? 0}
                  />
                ))}
              </section>
              <section className="ad-panel">
                <h2>Last observed screen</h2>
                <p className="ad-note">
                  Last screen in a visit with no new screen for 30+ minutes.
                  These are investigation leads, not confirmed exits.
                </p>
                {data.lastScreens.map((s) => (
                  <Bar
                    key={s.screen}
                    label={screenName(s.screen)}
                    value={s.visits}
                    total={Math.max(
                      1,
                      ...data.lastScreens.map((v) => v.visits),
                    )}
                  />
                ))}
                {!data.lastScreens.length && <Empty />}
              </section>
              <section className="ad-panel">
                <h2>Screen reach & active time</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Screen</th>
                      <th>Visits</th>
                      <th>Seconds / visit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.screens.map((s) => (
                      <tr key={s.screen}>
                        <td>{screenName(s.screen)}</td>
                        <td>{s.visits}</td>
                        <td>{num(s.seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="ad-note">
                  Visible time only. Closing a browser can lose its final timing
                  event.
                </p>
              </section>
              <section className="ad-panel">
                <h2>Errors & copy outcomes</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Outcome</th>
                      <th>Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.problems.map((p, i) => (
                      <tr key={i}>
                        <td>{(p.action || p.name).replaceAll("_", " ")}</td>
                        <td>
                          {p.outcome ?? "Failed"}{" "}
                          {p.status ? `(${p.status})` : ""}
                        </td>
                        <td>{p.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.problems.length && <Empty />}
              </section>
            </div>
          )}
          {tab === "questions" && (
            <section className="ad-panel">
              <h2>Where questions lose people</h2>
              <p className="ad-note">
                “Available” means this was the next unanswered question, or it
                was answered. It does not prove the screen was viewed. Stalled
                means no answer submitted for 30+ minutes. Different editions
                may use older frozen wording.
              </p>
              <div className="ad-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Available</th>
                      <th>Answered</th>
                      <th>Stalled here</th>
                      <th>Hit rate</th>
                      <th>Mean points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.questions.map((q) => (
                      <tr key={q.id}>
                        <td>{q.prompt}</td>
                        <td>{q.offered}</td>
                        <td>{q.answered}</td>
                        <td>{q.stalled}</td>
                        <td>{q.hit == null ? "—" : `${num(q.hit)}%`}</td>
                        <td>{num(q.score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.questions.length && <Empty />}
            </section>
          )}
          {tab === "people" && (
            <>
              <div className="ad-toolbar">
                <input
                  aria-label="Find a player or browser"
                  placeholder="Find a username or ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="ad-muted">
                  Most recent 200 owners and 100 visits in this period
                </span>
              </div>
              <section className="ad-panel">
                <h2>Players & saved games</h2>
                <p className="ad-note">
                  Guest labels represent game ownership, not identified people.
                  Mark your own records as tests to keep product metrics useful.
                </p>
                <div className="ad-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Runs</th>
                        <th>Answers</th>
                        <th>Finished</th>
                        <th>Last answer / open</th>
                        <th>Testing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.people
                        .filter((p) =>
                          (p.username ?? p.subject)
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((p) => (
                          <tr key={p.subject}>
                            <td>
                              <button
                                className="ad-link"
                                onClick={() => setSubject(p.subject)}
                              >
                                {p.username ?? "Guest " + p.subject.slice(-8)}
                              </button>
                            </td>
                            <td>{p.runs}</td>
                            <td>{p.answers}</td>
                            <td>{p.completed}</td>
                            <td>{time(p.last_seen)}</td>
                            <td>
                              <button
                                onClick={() =>
                                  void exclude(p.subject, !p.excluded)
                                }
                              >
                                {p.excluded
                                  ? "Restore to metrics"
                                  : "Mark as test"}
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="ad-panel">
                <h2>Recent browser visits</h2>
                <p className="ad-note">
                  Browsers can be shared, reset, or replaced; matching one is
                  not proof of a person’s identity. Marking a browser as a test
                  excludes its visits and the games observed on it.
                </p>
                <div className="ad-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Browser</th>
                        <th>Signed-in name observed</th>
                        <th>Device</th>
                        <th>Last screen</th>
                        <th>Last seen</th>
                        <th>Testing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentVisits
                        .filter((v) =>
                          [v.username, v.browser_id]
                            .join(" ")
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((v) => (
                          <tr key={v.id}>
                            <td>
                              <button
                                className="ad-link"
                                onClick={() =>
                                  setSubject("browser:" + v.browser_id)
                                }
                              >
                                {v.browser_id.slice(0, 8)}
                              </button>
                            </td>
                            <td>{v.username ?? "Guest"}</td>
                            <td>
                              {v.device} · {v.browser}
                            </td>
                            <td>{v.screen ? screenName(v.screen) : "—"}</td>
                            <td>{time(v.last_seen)}</td>
                            <td>
                              <button
                                onClick={() =>
                                  void exclude(
                                    "browser:" + v.browser_id,
                                    !v.excluded,
                                  )
                                }
                              >
                                {v.excluded
                                  ? "Restore to metrics"
                                  : "Mark as test"}
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
      {subject && (
        <dialog
          ref={modal}
          onCancel={() => setSubject("")}
          aria-label="Player journey"
          className="ad-detail-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSubject("");
          }}
        >
          <aside className="ad-person">
            <div className="ad-editor-head">
              <strong>
                {detail?.games.find((g) => g.username)?.username ??
                  (subject.startsWith("browser:") ? "Browser " : "Guest ") +
                    subject.slice(-8)}
              </strong>
              <button autoFocus onClick={() => setSubject("")}>
                Close
              </button>
            </div>
            {detailError ? (
              <p className="ad-error">{detailError}</p>
            ) : !detail ? (
              <p>Loading journey…</p>
            ) : (
              <>
                <p className="ad-note">
                  Latest 100 runs and 300 events. Original estimates are
                  available only for answers submitted since this release.
                </p>
                <h2>Saved games</h2>
                {detail.games.map((g) => (
                  <details
                    className="ad-game"
                    key={g.id}
                    open={detail.games.length === 1}
                  >
                    <summary>
                      {g.edition} ·{" "}
                      {g.kind === "onboarding"
                        ? "Legacy starting questions"
                        : "Daily"}{" "}
                      · {g.completed_at ? "Finished" : "Incomplete"} ·{" "}
                      {g.answers.filter((a) => a.answeredAt).length}/
                      {g.answers.length} ·{" "}
                      {num(
                        g.answers.reduce((sum, a) => sum + (a.score ?? 0), 0),
                      )}{" "}
                      pts
                    </summary>
                    <p className="ad-note">
                      Opened {time(g.created_at)}
                      {g.completed_at
                        ? " · Finished " + time(g.completed_at)
                        : ""}
                      {!g.is_ranked ? " · Practice" : ""}
                    </p>
                    {g.answers.map((a) => (
                      <div className="ad-answer" key={a.position}>
                        <h3>
                          {a.position}. {a.prompt}
                        </h3>
                        {a.answeredAt ? (
                          <>
                            <div className="ad-answer-values">
                              <span>
                                Estimate{" "}
                                <b>
                                  {a.estimate == null
                                    ? "Not recorded"
                                    : num(a.estimate)}
                                </b>
                              </span>
                              <span>
                                Range{" "}
                                <b>
                                  {num(a.lower)} – {num(a.upper)}
                                </b>
                              </span>
                              <span>
                                Answer{" "}
                                <b>
                                  {num(a.truth)} {a.unit}
                                </b>
                              </span>
                              <span>
                                {a.hit ? "Hit" : "Miss"}{" "}
                                <b>{num(a.score)} pts</b>
                              </span>
                            </div>
                            <small>{time(a.answeredAt)}</small>
                          </>
                        ) : (
                          <p className="ad-muted">Not answered</p>
                        )}
                      </div>
                    ))}
                  </details>
                ))}
                {!detail.games.length && (
                  <p>No saved games linked to this browser.</p>
                )}
                <h2>Event timeline</h2>
                <p className="ad-note">
                  Newest first. Screens are browser reports; saved answers above
                  are authoritative.
                </p>
                <ol className="ad-timeline">
                  {detail.events.map((e) => (
                    <li key={e.id}>
                      <time>{time(e.created_at)}</time>
                      <div>
                        <strong>{screenName(e.screen ?? e.name)}</strong> ·{" "}
                        {e.name.replaceAll("_", " ")}
                        {e.properties.outcome
                          ? " · " + e.properties.outcome
                          : ""}
                        {e.properties.action ? " · " + e.properties.action : ""}
                        {e.properties.status ? " · " + e.properties.status : ""}
                        {e.properties.activeMs != null
                          ? " · " + num(e.properties.activeMs / 1000) + " sec"
                          : ""}
                        <small>
                          {e.device} · {e.browser} · Visit{" "}
                          {e.visit_id.slice(0, 8)}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
                {!detail.events.length && <p>No events recorded yet.</p>}
              </>
            )}
          </aside>
        </dialog>
      )}
    </div>
  );
}
function Empty() {
  return <p className="ad-empty">No records in this period yet.</p>;
}
function Bar({
  label,
  value,
  total,
  extra,
}: {
  label: string;
  value: number;
  total: number;
  extra?: string;
}) {
  return (
    <div className="ad-bar">
      <div>
        <span>{label}</span>
        <strong>
          {num(value)} <small>{pct(value, total)}</small>
        </strong>
      </div>
      <div className="ad-bar-track">
        <i style={{ width: `${total ? (100 * value) / total : 0}%` }} />
      </div>
      {extra && <small className="ad-muted">{extra}</small>}
    </div>
  );
}
