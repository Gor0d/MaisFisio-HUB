export function calculateScaleTotal(points: Array<number | null | undefined>) {
  return points.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function hasFunctionalImprovement(entryTotal: number | null, exitTotal: number | null) {
  if (entryTotal === null || exitTotal === null) return null;
  return exitTotal > entryTotal;
}

export function barthelClassification(total: number) {
  if (total <= 20) return "Dependência total";
  if (total <= 60) return "Dependência severa";
  if (total <= 90) return "Dependência moderada";
  if (total <= 99) return "Dependência leve";
  return "Independente";
}
