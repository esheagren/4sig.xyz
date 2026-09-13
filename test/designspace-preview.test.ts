import assert from "node:assert/strict";
import test from "node:test";
import { installPreviewData } from "../src/designspace/fixtures";
import { screenById } from "../src/designspace/catalog";
import { onboardingQuestions } from "../api/_lib/onboarding-data";
import { withQuestionCopy } from "../api/_lib/question-copy";
import { Score } from "../shared/scoring";

test("design previews isolate identity and storage, score locally, and never forward unknown requests", async () => {
  const keys = [
    "window",
    "document",
    "localStorage",
    "sessionStorage",
    "fetch",
  ] as const;
  const originals = keys.map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  let networkCalls = 0;
  const actualStorage = new Map([
    ["four_sigma_identity_draft", "real player draft"],
  ]);
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: globalThis,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        getElementById: () => ({
          textContent: JSON.stringify(
            onboardingQuestions.map(withQuestionCopy),
          ),
        }),
      },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: actualStorage,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: actualStorage,
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: () => {
        networkCalls++;
        throw new Error("A preview must never reach a real API.");
      },
    });
    // The adapter requires a base URL even for absolute URLs.
    const originalLocation = Object.getOwnPropertyDescriptor(
      globalThis,
      "location",
    );
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { href: "https://4sig.xyz/designspace?view=screen" },
    });
    try {
      installPreviewData(screenById("daily-estimate"));
      const request = async (path: string, body = {}) =>
        (
          await fetch(path, { method: "POST", body: JSON.stringify(body) })
        ).json();
      const game = await request("/api/session/start");
      assert.equal(game.kind, "daily");
      assert.equal(game.questions.length, 5);
      assert.deepEqual(game.savedAnswers, []);
      const saved = await request("/api/session/answer", {
        questionId: game.questions[0].id,
        lower: 60,
        upper: 95,
      });
      assert.equal(saved.judgement.score, Score.calculateScore(60, 95, 80));
      assert.equal(saved.judgement.hit, true);
      assert.equal(
        (await request("/api/session/start")).savedAnswers.length,
        1,
      );
      await request("/api/user/profile", {
        displayName: "ChangedOnlyInPreview",
      });
      assert.equal(
        (await request("/api/auth/me")).user.displayName,
        "ChangedOnlyInPreview",
      );
      assert.equal(
        (await fetch("https://example.com/unrecognized-action")).status,
        400,
      );
      assert.equal(
        actualStorage.get("four_sigma_identity_draft"),
        "real player draft",
      );
      assert.equal(actualStorage.size, 1);
      assert.equal(networkCalls, 0);
      installPreviewData(screenById("daily-estimate"));
      assert.deepEqual((await request("/api/session/start")).savedAnswers, []);
      assert.equal(
        (await request("/api/auth/me")).user.displayName,
        "sample_player",
      );
    } finally {
      if (originalLocation)
        Object.defineProperty(globalThis, "location", originalLocation);
      else Reflect.deleteProperty(globalThis, "location");
    }
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
