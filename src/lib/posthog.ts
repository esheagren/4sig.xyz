import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
// Use reverse proxy to bypass ad blockers - requests go through our domain via Vercel rewrites
const POSTHOG_HOST = "/ingest";

export function initPostHog() {
  if (typeof window !== "undefined" && POSTHOG_KEY) {
    // Get existing device ID for consistent identification
    const existingDeviceId = localStorage.getItem("four_sigma_device_id");

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,

      // Capture pageviews automatically
      capture_pageview: true,

      // Enable session recording with console log capture
      enable_recording_console_log: true,

      // Don't respect Do Not Track (many browsers have it on by default, blocking all analytics)
      respect_dnt: false,

      // Persistence for anonymous users
      persistence: "localStorage+cookie",

      // Bootstrap with existing device ID for consistency with our auth system
      bootstrap: {
        distinctID: existingDeviceId || undefined,
      },

      // Session recording privacy settings
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: {
          password: true,
        },
      },

      // Disable in development to keep test data out of production
      loaded: (posthog) => {
        if (import.meta.env.DEV) {
          posthog.opt_out_capturing();
        }
      },
    });
  }
}

export { posthog };
