# 4σ design space

The authenticated `/designspace` home is the current product reference. The question library and Ink studies keep their existing URLs. Earlier visual directions are at `?view=archive`.

- `catalog.ts` is the naming directory: stable screen IDs, reference codes, component names, descriptions, and suggested interactions. Preserve IDs so saved review links keep working.
- `Studio.tsx` provides the searchable library, screen gallery, journeys, inspector, size controls, and links. Hash URLs preserve the chosen screen/component and viewport.
- `Preview.tsx` mounts the actual `IntervalGame`, auth context, and components in a separate document at `?view=screen&screen=…`. `GamePreview` seeds only the first rendered state; normal game interactions continue afterward. Reset remounts that state.
- `fixtures.ts` implements a sample API entirely within that document. Fetch requests fail closed, local/session storage is in memory, analytics are inert, and the frame’s CSP denies network connections. Never use real user data or forward unknown API routes.
- `api/designspace.ts` keeps both the workspace and every preview behind the existing signed design session. Question fixtures and reference answers are inserted only into authenticated HTML; they are not bundled into public JavaScript.

When a real component changes, the preview updates with it. Add new major states to the catalog and seed only what is needed to reach that state. Avoid duplicating product markup in the studio. Keep visual experiments distinct from the current implementation.

For review, select a screen, interact at a named viewport, use **Inspect component names**, or select **All screens** for the overview. **Copy view link** gives a direct review URL. Clipboard sharing inside a preview is real when explicitly clicked; account changes, game answers, and profile saves are simulated.

## Answer-review study

`AnswerReview.tsx` and `answer-review.css` are a design-only exploration on R02/R03. Each result has a range graphic and draft explanation: one visible sentence plus two on expansion. Use concrete historical trends and geographic contrasts in plain language, with context citations; see `answer-review-sources.md` for editorial guidance and verification. The optional `GamePreview.renderSummary` slot supplies the `ScoreStory` study only from the design entry; the live game retains its original result list. The scorecard fixtures include a miss and an exact answer for comparison.

The studio uses a compact toolbar and a window-height workbench. The screen library stays on the left; the library, gallery, and reference panel scroll independently. Fit scales the preview to both available width and height. On smaller windows, Details toggles the reference panel; Resources holds the libraries, live-game link, and sign-out action.

## Two-page results study

`ScoreStory.tsx` and `score-story.css` wrap R02/R03 in a viewport-height scroll container. The first snap point is a dark results page using the player's existing animated scorecard artwork (with its text hidden behind accessible HTML metrics), chosen color, and restrained red accents. Share sits at the bottom and uses the same GIF/PNG plus homepage clipboard behavior as the live game. `ScorecardShare.showCard` defaults to true; only this study hides the foreground card.

The second snap point is **Today's questions**, whose content can scroll beyond one viewport. Its top button returns to the score; the starting quiz's invitation to the daily game remains below the answers. Native scroll snap works with touch/trackpads; explicit buttons support keyboards. Reduced-motion preferences disable the score count-up and pattern animation.

Calibration here is for this completed game: hits divided by answers, with an absolute percentage-point distance from 95%. The daily average and daily-game count use the preview's sample history plus the current daily result (deduplicated by date); the initial quiz has no daily average yet and shows one quiz completed. No real history or account state is read. The live results layout remains unchanged.
