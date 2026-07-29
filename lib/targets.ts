export type IndicatorTarget = {
  indicator_id: string;
  unit_id: string | null;
  sector_id: string | null;
  target_value: number | string;
  comparison: "minimo" | "maximo" | string;
  valid_from: string;
  valid_until?: string | null;
};

export type TargetSituation = {
  target: IndicatorTarget;
  achieved: boolean;
};

export function effectiveTarget(
  targets: IndicatorTarget[],
  indicatorId: string,
  unitId: string | null,
  sectorId: string | null,
) {
  return targets
    .filter((target) => {
      if (target.indicator_id !== indicatorId) return false;
      if (unitId === null ? target.unit_id !== null : target.unit_id !== null && target.unit_id !== unitId) return false;
      if (sectorId === null) return target.sector_id === null;
      return target.sector_id === null || target.sector_id === sectorId;
    })
    .sort((left, right) => {
      const leftSpecificity = Number(left.unit_id !== null) + Number(left.sector_id !== null) * 2;
      const rightSpecificity = Number(right.unit_id !== null) + Number(right.sector_id !== null) * 2;
      return rightSpecificity - leftSpecificity
        || right.valid_from.localeCompare(left.valid_from);
    })[0] ?? null;
}

export function targetSituation(
  value: number,
  target: IndicatorTarget | null,
): TargetSituation | null {
  if (!target || !Number.isFinite(value)) return null;
  const targetValue = Number(target.target_value);
  if (!Number.isFinite(targetValue)) return null;

  return {
    target,
    achieved: target.comparison === "maximo"
      ? value <= targetValue
      : value >= targetValue,
  };
}
