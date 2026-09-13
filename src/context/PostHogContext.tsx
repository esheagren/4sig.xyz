import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef } from "react";
import { posthog, initPostHog } from "../lib/posthog";
import { useAuth } from "./AuthContext";
import { getDeviceId } from "../lib/device";

interface PostHogContextType {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
}

const PostHogContext = createContext<PostHogContextType | null>(null);

export function useAnalytics() {
  const context = useContext(PostHogContext);
  if (!context) {
    throw new Error("useAnalytics must be used within PostHogProvider");
  }
  return context;
}

interface PostHogProviderProps {
  children: ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  const { user, isAnonymous } = useAuth();
  const hasIdentified = useRef(false);
  const lastUserId = useRef<string | null>(null);

  // Initialize PostHog on mount
  useEffect(() => {
    initPostHog();
  }, []);

  // Handle user identification when auth state changes
  useEffect(() => {
    if (!user) return;

    const deviceId = getDeviceId();

    // Only identify if user changed or hasn't been identified yet
    if (lastUserId.current === user.id && hasIdentified.current) {
      return;
    }

    if (isAnonymous) {
      // Anonymous user - identify with device ID
      posthog.identify(deviceId, {
        isAnonymous: true,
        displayName: user.displayName,
      });
    } else {
      // Authenticated user - identify with user ID
      posthog.identify(user.id, {
        email: user.email,
        displayName: user.displayName,
        isAnonymous: false,
        gamesPlayed: user.gamesPlayed,
        totalScore: user.totalScore,
        calibrationRate: user.calibrationRate,
      });

      // Link the device ID to this user (critical for conversion tracking)
      // This connects all anonymous activity to the authenticated user
      if (deviceId !== user.id) {
        posthog.alias(deviceId, user.id);
      }
    }

    hasIdentified.current = true;
    lastUserId.current = user.id;
  }, [user, isAnonymous]);

  const value: PostHogContextType = {
    capture: (event, properties) => {
      posthog.capture(event, {
        ...properties,
        deviceId: getDeviceId(),
      });
    },
    identify: (userId, properties) => {
      posthog.identify(userId, properties);
    },
    reset: () => {
      posthog.reset();
      hasIdentified.current = false;
      lastUserId.current = null;
    },
  };

  return (
    <PostHogContext.Provider value={value}>{children}</PostHogContext.Provider>
  );
}

/** Design previews use the live UI without emitting product analytics. */
export function PreviewAnalyticsProvider({ children }: { children: ReactNode }) {
  return <PostHogContext.Provider value={{ capture: () => {}, identify: () => {}, reset: () => {} }}>{children}</PostHogContext.Provider>;
}
