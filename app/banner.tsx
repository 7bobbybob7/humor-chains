/** Outcome strip for the redirect-carried ?failed / ?deleted flags. */
export function Banner({
  failed,
  deleted,
}: {
  failed?: string;
  deleted?: string;
}) {
  if (failed) {
    const message =
      failed === "nothing-deleted"
        ? "Nothing was deleted — the row may already be gone, or your account may not have write access."
        : failed === "bad-id" || failed === "bad-move"
          ? "That request did not make sense. Nothing was changed."
          : failed;
    return (
      <p className="panel-sm mb-6 bg-red-tint px-4 py-3 text-sm font-semibold">
        {message}
      </p>
    );
  }

  if (deleted) {
    return (
      <p className="panel-sm mb-6 bg-green-tint px-4 py-3 text-sm font-semibold">
        {deleted === "step" ? "Step deleted." : "Chain deleted."}
      </p>
    );
  }

  return null;
}

/** Reads a search param that may arrive repeated. */
export function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s.slice(0, 300) : undefined;
}
