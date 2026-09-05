import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

function getPostHogClient(): PostHog | null {
  if (!process.env.POSTHOG_API_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1, // Flush immediately for serverless
      flushInterval: 0, // Disable interval flushing for serverless
    });
  }
  return posthogClient;
}

export function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const client = getPostHogClient();
  if (!client) return;

  client.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      $lib: "posthog-node",
      source: "server",
    },
  });
}

// Call this before serverless function terminates
export async function flushAnalytics(): Promise<void> {
  const client = getPostHogClient();
  if (client) {
    await client.flush();
  }
}
