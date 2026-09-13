import { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { PreviewAnalyticsProvider } from "../context/PostHogContext";
import { AnswerReview } from "./AnswerReview";
import reviewCss from "./answer-review.css?inline";
import IntervalGame from "../components/interval/IntervalGame";
import { installPreviewData } from "./fixtures";
import { screenById, components } from "./catalog";
import gameCss from "../components/interval/style.css?inline";
import appCss from "../App.css?inline";
import onboardingCss from "../components/interval/onboarding.css?inline";
import glossaryCss from "../components/interval/glossary.css?inline";

const params = new URLSearchParams(location.search),
  screen = screenById(params.get("screen"));
installPreviewData(screen);
const style = document.createElement("style");
style.textContent =
  appCss +
  gameCss +
  onboardingCss +
  glossaryCss +
  reviewCss +
  `
html.ds-inspecting [data-design-name]:hover { outline:2px solid #276c66; outline-offset:3px; cursor:crosshair; }
`;
document.head.append(style);
const selectors: Record<string, string> = {
  brand: ".brand, .bottom-nav-logo",
  "welcome-field": ".welcome-probability",
  "round-action": ".welcome-play",
  "practice-tip": ".practice-tip",
  question: ".question-block",
  "number-pad": ".number-entry",
  range: ".instrument",
  "hold-submit": ".commit-control",
  "answer-pin": ".truth",
  points: ".round-score",
  "scoring-examples": ".scoring-examples",
  "worldview-grid": ".worldview-grid",
  "calibration-setup": ".setup-measures",
  personality: ".personality-picker",
  scorecard: ".scorecard-button",
  share: ".scorecard-share-actions",
  "bottom-nav": ".bottom-nav",
  "player-menu": ".player-panel",
  "auth-dialog": ".auth-modal",
  "answer-review": ".answer-review",
};
export default function Preview() {
  useEffect(() => {
    const annotate = () => {
      for (const [id, selector] of Object.entries(selectors))
        document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
          node.dataset.designName = components.find((c) => c.id === id)?.name;
          node.dataset.designComponent = id;
        });
    };
    const observer = new MutationObserver(annotate);
    observer.observe(document.body, { childList: true, subtree: true });
    annotate();
    const message = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== parent) return;
      if (event.data?.type === "design-inspect")
        document.documentElement.classList.toggle(
          "ds-inspecting",
          !!event.data.enabled,
        );
    };
    const pick = (event: MouseEvent) => {
      if (!document.documentElement.classList.contains("ds-inspecting")) return;
      const target = (event.target as Element).closest<HTMLElement>(
        "[data-design-component]",
      );
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      parent.postMessage(
        { type: "design-component", id: target.dataset.designComponent },
        location.origin,
      );
    };
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape")
        document.documentElement.classList.remove("ds-inspecting");
    };
    window.addEventListener("message", message);
    document.addEventListener("click", pick, true);
    document.addEventListener("keydown", keys);
    return () => {
      observer.disconnect();
      window.removeEventListener("message", message);
      document.removeEventListener("click", pick, true);
      document.removeEventListener("keydown", keys);
    };
  }, []);
  return (
    <MemoryRouter>
      <AuthProvider>
        <PreviewAnalyticsProvider>
          <IntervalGame
            preview={{
              ...screen.preview,
              renderResults: (results) => <AnswerReview results={results} />,
            }}
          />
        </PreviewAnalyticsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}
