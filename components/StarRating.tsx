export default function StarRating({
  rating,
  count,
  size = "sm"
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md";
}) {
  const full = Math.round(rating);
  const textSize = size === "md" ? "text-base" : "text-sm";
  return (
    <span className={`inline-flex items-center gap-1 ${textSize}`}>
      <span className="text-amber-500" aria-hidden>
        {"★".repeat(full)}
        {"☆".repeat(5 - full)}
      </span>
      <span className="font-medium text-ink/80">{rating > 0 ? rating.toFixed(1) : "New"}</span>
      {typeof count === "number" && (
        <span className="text-ink/50">({count} review{count === 1 ? "" : "s"})</span>
      )}
    </span>
  );
}
