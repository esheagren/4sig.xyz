# 4σ design space

The authenticated `/designspace` home is the current product reference. The question library and Ink studies keep their existing URLs. Earlier visual directions are at `?view=archive`.

- `catalog.ts` is the naming directory: stable screen IDs, reference codes, component names, descriptions, and suggested interactions. Preserve IDs so saved review links keep working.
- `Studio.tsx` provides the searchable library, screen gallery, journeys, inspector, size controls, and links. Hash URLs preserve the chosen screen/component and viewport.
- `Preview.tsx` mounts the actual `IntervalGame`, auth context, and components in a separate document at `?view=screen&screen=…`. `GamePreview` seeds only the first rendered state; normal game interactions continue afterward. Reset remounts that state.
- `fixtures.ts` implements a sample API entirely within that document. Fetch requests fail closed, local/session storage is in memory, analytics are inert, and the frame’s CSP denies network connections. Never use real user data or forward unknown API routes.
- `api/designspace.ts` keeps both the workspace and every preview behind the existing signed design session. Question fixtures and reference answers are inserted only into authenticated HTML; they are not bundled into public JavaScript.

When a real component changes, the preview updates with it. Add new major states to the catalog and seed only what is needed to reach that state. Avoid duplicating product markup in the studio. Keep visual experiments distinct from the current implementation.

For review, select a screen, interact at a named viewport, use **Inspect component names**, or select **All screens** for the overview. **Copy view link** gives a direct review URL. Clipboard sharing inside a preview is real when explicitly clicked; account changes, game answers, and profile saves are simulated.

## Shared results components

`src/components/interval/ScoreStory.tsx` and `AnswerReview.tsx` power both the live game and R02/R03. The first page uses the player’s animated artwork and color, current score, calibration against 95%, and a round Share button near the bottom. The second snap point is **Today’s questions**: each answer has a range graphic, expandable context, and sources. Long reviews scroll freely, with buttons to return to the score or continue playing. Reduced motion disables the count-up and animation.

Approved context for the eight starting questions is served by `api/_lib/answer-insights.ts` only with revealed judgements. Exact IDs also map the matching questions from the original ten-question edition. Other questions use their stored answer context. Context and reference answers are never bundled in public JavaScript. See `answer-review-sources.md` for editorial guidance and source verification. Fixtures include a miss and an exact answer.

Daily comparisons use completed, ranked games for the same edition. The API counts strictly lower scores, including correct handling of ties, and returns personal daily average and completed ranked daily count. Percent ahead excludes self, rounds down, and waits for 20 finishers. A single finisher sees “First to finish today”; a zero mean cannot produce a percentage comparison. Starting scores omit competition and completion count; practice is excluded from totals. Preview statistics remain isolated sample data.

Only a small red mark appears at the bottom of the score page. It expands into dark navigation when the question review becomes active. Hidden navigation controls cannot receive keyboard focus. Review content has bottom padding to clear the navigation.

The studio uses a compact toolbar and a window-height workbench. The screen library stays on the left; the library, gallery, and reference panel scroll independently. Fit scales the preview to both available width and height. On smaller windows, Details toggles the reference panel; Resources holds the libraries, live-game link, and sign-out action.
