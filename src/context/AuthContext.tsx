import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
interface User {
  id: string;
  email: string | null;
  displayName: string;
  isAnonymous: boolean;
  avatarIcon?: string | null;
  avatarColor?: string | null;
  scorecardStyle?: string | null;
  hasPersonality?: boolean;
  sessionCount: number;
  questionsAnswered?: number;
  onboarding?: { sessionId: string; score: number; hits: number; count: number; version: string } | null;
  totalScore: number;
  averageScore: number;
  gamesPlayed: number;
  currentStreak: number;
  bestStreak: number;
  calibrationRate: number;
  questionsCaptured: number;
  bestSingleScore: number;
  createdAt: string;
}
type Outcome = { success: boolean; error?: string; suggestions?: string[] };
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAnonymous: boolean;
  hasClaimedUsername: boolean;
  authToken: null;
  login: (email: string, password: string) => Promise<Outcome>;
  signup: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<Outcome>;
  claimAccount: (email: string, password: string) => Promise<Outcome>;
  claimUsername: (username: string) => Promise<Outcome>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider required");
  return value;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [isLoading, setLoading] = useState(true),
    initialized = useRef(false);
  const authRevision = useRef(0), authChanging = useRef(0), readSequence = useRef(0);
  const request = useCallback(
    async (
      action: string,
      body: unknown = {},
      method = "POST",
    ): Promise<Outcome> => {
      const changing = action !== "me";
      if (!changing && authChanging.current) return { success: true };
      if (changing) { authRevision.current++; authChanging.current++; }
      const revision = authRevision.current, sequence = ++readSequence.current;
      try {
        const response = await fetch("/api/auth/" + action, {
          method,
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
        });
        const data = await response.json();
        if (!response.ok)
          return {
            success: false,
            error: data.error ?? "Could not connect. Please try again.",
          };
        if (data.user && revision === authRevision.current &&
            (changing || (!authChanging.current && sequence === readSequence.current))) setUser(data.user);
        return { success: true };
      } catch {
        return {
          success: false,
          error: "Could not connect. Please try again.",
        };
      } finally {
        if (changing) { authChanging.current--; authRevision.current++; }
      }
    },
    [],
  );
  const refreshUser = useCallback(async () => {
    await request("me", {}, "GET");
  }, [request]);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      void refreshUser().finally(() => setLoading(false));
    }
  }, [refreshUser]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void refreshUser(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refreshUser]);
  async function logout() {
    const result = await request("logout");
    if (result.success) await refreshUser();
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAnonymous: user?.isAnonymous ?? true,
        hasClaimedUsername: !!user && !user.isAnonymous && !user.email,
        authToken: null,
        login: (email, password) => request("login", { email, password }),
        signup: (email, password, displayName) =>
          request("signup", { email, password, displayName }),
        claimUsername: (username) => request("claim-username", { username }),
        claimAccount: (email, password) =>
          request("claim-account", { email, password }),
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
