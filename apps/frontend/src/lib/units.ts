export function isSmallScale(sourceDevice?: string | null): boolean {
  return !!sourceDevice?.toLowerCase().includes("small");
}

export function shouldUseGrams(
  stage: string | null | undefined,
  sourceDevice?: string | null,
): boolean {
  return stage === "seedling" || isSmallScale(sourceDevice);
}

export function formatWeight(
  lbs: number | null | undefined,
  stage: string | null | undefined,
  sourceDevice?: string | null,
): string {
  if (lbs === null || lbs === undefined || !Number.isFinite(Number(lbs))) return "—";
  return shouldUseGrams(stage, sourceDevice)
    ? `${(Number(lbs) * 453.592).toFixed(1)} g`
    : `${Number(lbs).toFixed(2)} lbs`;
}

export function formatFc(
  lbs: number | null | undefined,
  stage: string | null | undefined,
  sourceDevice?: string | null,
): string | null {
  if (lbs === null || lbs === undefined) return null;
  return `FC ${formatWeight(lbs, stage, sourceDevice)}`;
}