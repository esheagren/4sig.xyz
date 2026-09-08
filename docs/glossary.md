# Question glossary

Definitions live in the existing Neon PostgreSQL database. `glossary_terms` stores each shared concept, its short explanation, source and verification date; `question_glossary` connects it to an exact phrase in a question. One concept can serve many questions. Links are explicit, so ordinary words are not automatically annotated across the bank.

The game and protected question manager show a faint dotted underline. Tapping the phrase opens the same short definition in a phone-sized dialog. Escape, the close control and tapping the backdrop dismiss it, returning focus to the term. Answers stay concealed in the manager.

## Editorial rules

- Use one or two sentences, at most 65 words and 450 characters. Aim for an eighth-grade reading level; define necessary jargon with familiar words.
- Explain the idea, not the answer to the question. Avoid real figures, country comparisons or rankings that could reveal the answer.
- Use a brief, explicitly made-up numerical example when it makes a concept easier to understand. A higher Gini value means more inequality; it is not a percentage of income.
- Keep the full explanation on one phone screen. Do not require following a link or opening another definition.
- Record a primary source and verification date. Sources are editorial metadata, not part of the player popup.
- Check each question link in context, especially terminology that appears inside a publication’s name.

## Maintaining definitions

The initial reviewed content and explicit question links are in `editorial/glossary.json`. Edit this manifest and run `node --env-file=.env.preview.local --import tsx scripts/postgres/apply-glossary.ts` against preview. Check the question manager, then run the same command with `.env` for production. The script applies `006_glossary.sql` and upserts the manifest atomically, validating sentence length and that every linked phrase actually occurs in its question. Missing questions or mismatched phrases abort the whole update. It never changes game answers, question wording or daily schedules.

Apply the migration before deploying code that reads glossary tables. The empty-database import creates the schema; apply the reviewed glossary after importing and updating the editorial question bank. Reapplying the manifest preserves other terms and links; retiring a link requires an explicit database deletion.

Game snapshots remain unchanged. The server looks up current glossary definitions and computes spans against the actual saved prompt each time a game is loaded. An old prompt without the linked phrase gets no annotation. Public game responses contain only the linked title, definition and text offsets, without source notes or unrevealed answers.
