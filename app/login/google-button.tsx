"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        // Exactly /auth/callback, no query string.
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      // On success the browser navigates to Google and this never runs.
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (e) {
      // Previously the failure was swallowed and the button simply re-enabled,
      // so a user whose sign-in could not start saw nothing happen at all.
      setError(e instanceof Error ? e.message : "Could not reach Google.");
      setLoading(false);
    }
  }

  return (
    <>
    <button
      onClick={signIn}
      disabled={loading}
      className="press panel-sm flex w-full items-center justify-center gap-3 bg-paper-raised px-5 py-3.5 font-bold text-ink disabled:opacity-60"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z" />
        <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
      </svg>
      {loading ? "Redirecting to Google…" : "Continue with Google"}
    </button>
    {error && (
      <p className="panel-sm mt-4 bg-red-tint px-4 py-3 text-sm font-semibold">
        Could not start sign-in: {error}
      </p>
    )}
    </>
  );
}
