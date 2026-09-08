const STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-sky-100 text-sky-800",
  ESCROW_FUNDED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  COMPLETED_BY_PROVIDER: "bg-violet-100 text-violet-800",
  RELEASED: "bg-emerald-100 text-emerald-800",
  DISPUTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
  REFUNDED: "bg-gray-100 text-gray-700"
};

const LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  ACCEPTED: "Accepted",
  ESCROW_FUNDED: "Escrow funded",
  IN_PROGRESS: "In progress",
  COMPLETED_BY_PROVIDER: "Awaiting your confirmation",
  RELEASED: "Paid & closed",
  DISPUTED: "In dispute",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded"
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill ${STYLES[status] ?? "bg-gray-100 text-gray-700"}`}>{LABELS[status] ?? status}</span>
  );
}
