import { useEffect, useState } from "react";
import type {
  AdminQuestion,
  CalendarDay,
} from "../../api/_lib/admin-questions";
import { adminRequest, time } from "./api";
type Workspace = {
  today: string;
  timezone: string;
  questions: AdminQuestion[];
  days: CalendarDay[];
};
export default function Questions() {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [view, setView] = useState("calendar");
  const [selectedDay, setDay] = useState(""),
    [lineup, setLineup] = useState<string[]>([]),
    [selected, setSelected] = useState<AdminQuestion | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("daily"),
    [status, setStatus] = useState("all");
  async function refresh() {
    const result = await adminRequest<Workspace>("workspace");
    setData(result);
    return result;
  }
  useEffect(() => {
    void refresh()
      .then((d) => {
        setDay(d.today);
        setLineup(d.days[0].ids);
      })
      .catch((e) => setError(e.message));
  }, []);
  const day = data?.days.find((d) => d.date === selectedDay);
  const unsaved = dirty || (!!day && lineup.join() !== day.ids.join());
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  async function reload() {
    if (
      busy ||
      (unsaved &&
        !confirm("Discard unsaved edits and reload the saved workspace?"))
    )
      return;
    try {
      const d = await refresh();
      const next = d.days.find((v) => v.date === selectedDay) ?? d.days[0];
      setDay(next.date);
      setLineup(next.ids);
      if (selected)
        setSelected(d.questions.find((q) => q.id === selected.id) ?? null);
      setDirty(false);
      setError("");
      setMessage("Reloaded saved data.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function choose(q: AdminQuestion) {
    if (busy) return;
    if (dirty && !confirm("Discard your unsaved question edits?")) return;
    setSelected(structuredClone(q));
    setDirty(false);
    setMessage("");
  }
  function chooseDay(d: CalendarDay) {
    if (busy) return;
    if (
      day &&
      lineup.join() !== day.ids.join() &&
      !confirm("Discard your unsaved lineup?")
    )
      return;
    setDay(d.date);
    setLineup(d.ids);
    setMessage("");
  }
  async function saveQuestion(q: AdminQuestion) {
    setBusy(true);
    setError("");
    try {
      await adminRequest("save-question", q);
      const d = await refresh();
      setSelected(d.questions.find((n) => n.id === q.id)!);
      setDirty(false);
      setMessage("Question saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveLineup() {
    if (!day) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest("save-lineup", {
        date: day.date,
        ids: lineup,
        revision: day.revision,
      });
      await refresh();
      setMessage("Lineup saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="ad-loading">{error || "Loading the question bank…"}</div>
    );
  const filtered = data.questions.filter(
    (q) =>
      (filter === "all" || q.usage === filter) &&
      (status === "all" || q.status === status) &&
      [q.prompt, q.topic, q.geography, q.id]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const ready = data.questions.filter(
    (q) =>
      q.active &&
      q.usage === "daily" &&
      q.status === "ready" &&
      q.verified <= selectedDay &&
      q.reviewDue >= selectedDay,
  );
  const change = (next: AdminQuestion) => {
    setSelected(next);
    setDirty(true);
  };
  return (
    <div className="ad-question-workspace">
      <div className="ad-toolbar">
        <div className="ad-segment">
          {["calendar", "bank"].map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === "calendar"
                ? "Next 14 days"
                : `Question bank · ${data.questions.length}`}
            </button>
          ))}
        </div>
        <span className="ad-muted">Editions follow Pacific time</span>
        <button disabled={busy} onClick={() => void reload()}>
          Reload saved
        </button>
      </div>
      {error && (
        <div className="ad-error" role="alert">
          {error} <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {message && (
        <div className="ad-success" role="status">
          {message}
        </div>
      )}
      <div className={"ad-editor-layout" + (selected ? " has-editor" : "")}>
        <div className="ad-library">
          {view === "calendar" ? (
            <>
              <div className="ad-days">
                {data.days.map((d) => (
                  <button
                    key={d.date}
                    aria-pressed={selectedDay === d.date}
                    onClick={() => chooseDay(d)}
                  >
                    <span>
                      {new Date(d.date + "T12:00:00").toLocaleDateString(
                        undefined,
                        { weekday: "short" },
                      )}
                    </span>
                    <strong>
                      {new Date(d.date + "T12:00:00").toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}
                    </strong>
                    <small>{d.state}</small>
                  </button>
                ))}
              </div>
              <div className="ad-section-heading">
                <h1>{selectedDay === data.today ? "Today" : selectedDay}</h1>
                <span className={"ad-badge " + day?.state}>{day?.state}</span>
                <button
                  className="ad-primary"
                  disabled={
                    busy ||
                    day?.state === "locked" ||
                    (day?.state !== "suggested" &&
                      lineup.join() === day?.ids.join())
                  }
                  onClick={() => void saveLineup()}
                >
                  {day?.state === "suggested"
                    ? "Use this lineup"
                    : "Save lineup"}
                </button>
              </div>
              <p className="ad-note">
                {day?.state === "locked"
                  ? "Today’s lineup cannot be edited here. Started editions keep their original questions."
                  : "Suggested lineups rotate older questions back in and spread topics. Save a lineup to choose its order. Forecasts may change as you edit the bank or earlier days."}
              </p>
              <ol className="ad-lineup">
                {lineup.map((id, i) => {
                  const q = data.questions.find((q) => q.id === id);
                  return (
                    <li key={i}>
                      <span className="ad-position">{i + 1}</span>
                      <div className="ad-lineup-copy">
                        <small>
                          {q?.topic} · {q?.role}
                        </small>
                        <button
                          className="ad-question-link"
                          onClick={() => q && choose(q)}
                        >
                          {day?.prompts[id] ||
                            q?.prompt ||
                            "Question unavailable"}
                        </button>
                        <span className="ad-muted">{q?.insight.short}</span>
                        {day?.state !== "locked" && (
                          <select
                            aria-label={`Replace question ${i + 1}`}
                            value={id}
                            onChange={(e) =>
                              setLineup(
                                lineup.map((v, n) =>
                                  n === i ? e.target.value : v,
                                ),
                              )
                            }
                          >
                            {ready
                              .filter(
                                (q) => q.id === id || !lineup.includes(q.id),
                              )
                              .map((q) => (
                                <option key={q.id} value={q.id}>
                                  {q.prompt}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                      <div className="ad-order">
                        <button
                          aria-label={`Move question ${i + 1} up`}
                          disabled={busy || i === 0 || day?.state === "locked"}
                          onClick={() =>
                            setLineup((a) => {
                              const b = [...a];
                              [b[i - 1], b[i]] = [b[i], b[i - 1]];
                              return b;
                            })
                          }
                        >
                          ↑
                        </button>
                        <button
                          aria-label={`Move question ${i + 1} down`}
                          disabled={
                            busy ||
                            i === lineup.length - 1 ||
                            day?.state === "locked"
                          }
                          onClick={() =>
                            setLineup((a) => {
                              const b = [...a];
                              [b[i + 1], b[i]] = [b[i], b[i + 1]];
                              return b;
                            })
                          }
                        >
                          ↓
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {lineup.length < 5 && (
                <p className="ad-error">
                  Only {lineup.length} eligible questions are available. Review
                  the bank before this edition.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="ad-toolbar">
                <input
                  aria-label="Search question bank"
                  placeholder="Search questions, topics, places…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Question use"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="daily">Daily bank</option>
                  <option value="all">All questions</option>
                  <option value="onboarding">Legacy starting questions</option>
                </select>
                <select
                  aria-label="Editorial status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {["all", "ready", "needs_review", "retired"].map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ad-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Question · {filtered.length}</th>
                      <th>Topic</th>
                      <th>Status</th>
                      <th>Review due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((q) => (
                      <tr
                        key={q.id}
                        className={selected?.id === q.id ? "ad-selected" : ""}
                      >
                        <td>
                          <button
                            className="ad-question-link"
                            onClick={() => choose(q)}
                          >
                            {q.prompt}
                          </button>
                        </td>
                        <td>{q.topic}</td>
                        <td>
                          <span className="ad-badge">
                            {q.status.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td
                          className={
                            q.reviewDue < data.today ? "ad-warning" : ""
                          }
                        >
                          {q.reviewDue || "Unset"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        {selected && (
          <QuestionEditor
            key={selected.id}
            question={selected}
            onChange={change}
            onSave={() => void saveQuestion(selected)}
            busy={busy}
            dirty={dirty}
            onClose={() => {
              if (!dirty || confirm("Discard your unsaved question edits?")) {
                setSelected(null);
                setDirty(false);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
function QuestionEditor({
  question: q,
  onChange,
  onSave,
  onClose,
  busy,
  dirty,
}: {
  question: AdminQuestion;
  onChange: (q: AdminQuestion) => void;
  onSave: () => void;
  onClose: () => void;
  busy: boolean;
  dirty: boolean;
}) {
  const [history, setHistory] = useState<
    { created_at: string; revision: string }[]
  >([]);
  useEffect(() => {
    void adminRequest<{ history: typeof history }>("history&id=" + q.id)
      .then((d) => setHistory(d.history))
      .catch(() => {});
  }, [q.id, q.revision]);
  const field = (
    key:
      | "prompt"
      | "answer"
      | "unit"
      | "topic"
      | "period"
      | "geography"
      | "definition"
      | "notes"
      | "source"
      | "sourceUrl"
      | "verified"
      | "reviewDue",
    label: string,
    multi = false,
  ) => (
    <label>
      {label}
      {multi ? (
        <textarea
          rows={key === "prompt" ? 3 : 4}
          value={q[key]}
          onChange={(e) => onChange({ ...q, [key]: e.target.value })}
        />
      ) : (
        <input
          type={["verified", "reviewDue"].includes(key) ? "date" : "text"}
          value={q[key]}
          onChange={(e) => onChange({ ...q, [key]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <aside className="ad-editor">
      <form
        inert={busy}
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <div className="ad-editor-head">
          <strong>
            Edit question <small>r{q.revision}</small>
          </strong>
          <button type="button" onClick={onClose} aria-label="Close editor">
            ×
          </button>
          <button className="ad-primary" disabled={!dirty || busy}>
            {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
        <p className="ad-note">
          Question, answer, and source edits apply to future editions. Context
          updates appear beneath already revealed answers too.
        </p>
        {field("prompt", "Question", true)}
        <div className="ad-fields">
          {field("answer", "Correct answer")}
          {field("unit", "Unit")}
        </div>
        <label>
          One-sentence context
          <textarea
            rows={3}
            value={q.insight.short}
            onChange={(e) =>
              onChange({
                ...q,
                insight: { ...q.insight, short: e.target.value },
              })
            }
          />
        </label>
        <label>
          Expanded context
          <textarea
            rows={6}
            value={q.insight.more}
            onChange={(e) =>
              onChange({
                ...q,
                insight: { ...q.insight, more: e.target.value },
              })
            }
          />
        </label>
        <p className="ad-note">
          Use concrete comparisons, change over time, or surprising differences.
          Keep the writing simple and the idea substantive.
        </p>
        <fieldset>
          <legend>Context sources</legend>
          {q.insight.sources.map((source, i) => (
            <div className="ad-source" key={i}>
              <input
                aria-label={`Source ${i + 1} title`}
                placeholder="Source title"
                value={source.label}
                onChange={(e) =>
                  onChange({
                    ...q,
                    insight: {
                      ...q.insight,
                      sources: q.insight.sources.map((s, n) =>
                        n === i ? { ...s, label: e.target.value } : s,
                      ),
                    },
                  })
                }
              />
              <input
                aria-label={`Source ${i + 1} URL`}
                placeholder="https://…"
                type="url"
                value={source.url}
                onChange={(e) =>
                  onChange({
                    ...q,
                    insight: {
                      ...q.insight,
                      sources: q.insight.sources.map((s, n) =>
                        n === i ? { ...s, url: e.target.value } : s,
                      ),
                    },
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...q,
                    insight: {
                      ...q.insight,
                      sources: q.insight.sources.filter((_, n) => n !== i),
                    },
                  })
                }
                aria-label={`Remove source ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={q.insight.sources.length >= 12}
            onClick={() =>
              onChange({
                ...q,
                insight: {
                  ...q.insight,
                  sources: [...q.insight.sources, { label: "", url: "" }],
                },
              })
            }
          >
            + Add source
          </button>
        </fieldset>
        <details open>
          <summary>Editorial & verification</summary>
          <div className="ad-fields">
            <label>
              Status
              <select
                value={q.status}
                onChange={(e) => onChange({ ...q, status: e.target.value })}
              >
                {["ready", "needs_review", "retired"].map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Role
              <select
                value={q.role}
                onChange={(e) => onChange({ ...q, role: e.target.value })}
              >
                <option value="core">Core</option>
                <option value="reference">Reference</option>
              </select>
            </label>
            {field("topic", "Topic")}
            {field("period", "Observation period")}
            {field("geography", "Geography")}
            {field("verified", "Verified on")}
            {field("reviewDue", "Review due")}
          </div>
          {field("definition", "Measure definition", true)}
          {field("source", "Answer source")}
          {field("sourceUrl", "Answer source URLs (separate with ;)")}
          {field("notes", "Verification / editorial notes", true)}
        </details>
        <details>
          <summary>Reader preview</summary>
          <div className="ad-reader">
            <h3>{q.prompt}</h3>
            <p>
              <strong>
                {q.answer} {q.unit}
              </strong>
            </p>
            <p>{q.insight.short}</p>
            <p>{q.insight.more}</p>
            {q.insight.sources.map((s, i) => (
              <p key={i}>{s.label}</p>
            ))}
          </div>
        </details>
        <details>
          <summary>Change history · {history.length}</summary>
          {history.length ? (
            history.map((h) => (
              <p key={h.revision}>
                Revision {h.revision} · {time(h.created_at)}
              </p>
            ))
          ) : (
            <p>No admin edits yet.</p>
          )}
        </details>
        <small className="ad-muted">
          {q.id} · {q.usage} · Last used {q.lastUsed ?? "never"}
        </small>
      </form>
    </aside>
  );
}
