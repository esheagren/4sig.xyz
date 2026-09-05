import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
type Mode = "login" | "signup";
export function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: Mode;
}) {
  const { login, signup, user } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>(initialMode),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [username, setUsername] = useState("");
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError("");
      setPassword("");
      dialog.current?.showModal();
    }
  }, [isOpen, initialMode]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const result =
      mode === "login"
        ? await login(email, password)
        : await signup(
            email,
            password,
            user && !user.isAnonymous ? user.displayName : username,
          );
    setPending(false);
    if (result.success) onClose();
    else setError(result.error ?? "Could not sign in. Please try again.");
  }
  if (!isOpen) return null;
  return createPortal(
    <dialog
      ref={dialog}
      className="auth-modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="auth-dialog-head">
        <h2>
          {mode === "login"
            ? "Welcome back."
            : user && !user.isAnonymous
              ? "Keep your mark."
              : "Make it yours."}
        </h2>
        <button type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <form onSubmit={submit} className="auth-form">
        {mode === "signup" && (!user || user.isAnonymous) && (
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              pattern="[a-zA-Z0-9_]{3,20}"
              minLength={3}
              maxLength={20}
              required
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === "signup" ? 12 : 1}
            maxLength={256}
            required
          />
          {mode === "signup" && <small>At least 12 characters.</small>}
        </label>
        <p className="auth-error" role="status">
          {error}
        </p>
        <button className="auth-submit" disabled={pending}>
          {pending ? "Saving…" : mode === "login" ? "Sign in" : "Save sign-in"}
        </button>
      </form>
      <button
        className="auth-switch"
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError("");
        }}
      >
        {mode === "login"
          ? "Create an account"
          : "Already have an account? Sign in"}
      </button>
    </dialog>,
    document.body,
  );
}
