export default function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-okgreen/30 bg-okgreen/10 text-okgreen"
      }`}
    >
      {error ?? ok}
    </div>
  );
}
