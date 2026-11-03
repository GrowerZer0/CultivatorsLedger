export function stageLabel(stage: string | null | undefined): string {
  const s = (stage || "seedling").toLowerCase();
  return s === "flowering" ? "Flower"
    : s === "vegetative" ? "Veg"
    : s === "seedling" ? "Seedling"
    : s === "dry" ? "Dry"
    : s === "cure" ? "Cure"
    : s.charAt(0).toUpperCase() + s.slice(1);
}

export function weekLabel(
  stage: string | null | undefined,
  stageStartedAt: string | Date | null | undefined,
): string {
  const s = (stage || "seedling").toLowerCase();
  if (!stageStartedAt) return stageLabel(stage);

  const days = Math.floor(
    (Date.now() - new Date(stageStartedAt).getTime()) / 86_400_000,
  );

  if (s === "flowering") return `Flower Week ${Math.floor(days / 7) + 1}`;
  if (s === "vegetative") return `Veg Week ${Math.floor(days / 7) + 1}`;
  if (s === "dry" || s === "cure") return `Day ${days + 1}`;
  if (s === "seedling") return `Day ${days + 1}`;
  return stageLabel(stage);
}