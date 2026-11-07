"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-16">
      <div className="panel p-7 text-center">
        <p className="font-display text-5xl font-black">😬</p>
        <h1 className="mt-3 font-display text-2xl font-black">
          That page fell over
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Something broke on our end, not yours.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="press panel-sm bg-comic-red px-5 py-2.5 font-bold text-white"
          >
            Try again
          </button>
          <Link
            href="/"
            className="press panel-sm bg-paper-raised px-5 py-2.5 font-bold"
          >
            All chains
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 font-mono text-[11px] text-ink-soft">
            ref {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
