# 4σ design space

The authenticated `/designspace` home is the current product reference. The question library and Ink studies keep their existing URLs. Earlier visual directions are at `?view=archive`.

- `catalog.ts` is the naming directory: stable screen IDs, reference codes, component names, descriptions, and suggested interactions. Preserve IDs so saved review links keep working.
- `Studio.tsx` provides the searchable library, screen gallery, journeys, inspector, size controls, and links. Hash URLs preserve the chosen screen/component and viewport.
- `Preview.tsx` mounts the actual `IntervalGame`, auth context, and components in a separate document at `?view=screen&screen=…`. `GamePreview` seeds only the first rendered state; normal game interactions continue afterward. Reset remounts that state.
- `fixtures.ts` implements a sample API entirely within that document. Fetch requests fail closed, local/session storage is in memory, analytics are inert, and the frame’s CSP denies network connections. Never use real user data or forward unknown API routes.
- `api/designspace.ts` keeps both the workspace and every preview behind the existing signed design session. Question fixtures and reference answers are inserted only into authenticated HTML; they are not bundled into public JavaScript.

When a real component changes, the preview updates with it. Add new major states to the catalog and seed only what is needed to reach that state. Avoid duplicating product markup in the studio. Keep visual experiments distinct from the current implementation.

For review, select a screen, interact at a named viewport, use **Inspect component names**, or select **All screens** for the overview. **Copy view link** gives a direct review URL. Clipboard sharing inside a preview is real when explicitly clicked; account changes, game answers, and profile saves are simulated.
