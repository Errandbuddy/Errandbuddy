import { formatXLM, xlmToNgnEstimate } from "@/lib/currency";

export default function Money({ xlm, className = "" }: { xlm: number; className?: string }) {
  return (
    <span className={className}>
      <span className="font-semibold">{formatXLM(xlm)}</span>{" "}
      <span className="text-ink/50 text-sm">(~{xlmToNgnEstimate(xlm)})</span>
    </span>
  );
}
