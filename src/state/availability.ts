import type { AvailabilityRecord, SiteLabel } from "../types/domain";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function getSiteAvailability(
  siteAvailability: Map<SiteLabel, AvailabilityRecord>,
  label: SiteLabel,
): AvailabilityRecord | null {
  return siteAvailability.get(label) || null;
}

export function isSiteUnavailable(
  siteAvailability: Map<SiteLabel, AvailabilityRecord>,
  label: SiteLabel,
): boolean {
  const availability = getSiteAvailability(siteAvailability, label);
  return availability?.available === false && !availability?.verifiedByWebview;
}

export function getLabelsToProbe(
  targetLabels: SiteLabel[],
  siteMap: Map<SiteLabel, unknown>,
  siteAvailability: Map<SiteLabel, AvailabilityRecord>,
  pendingSiteAvailability: Set<SiteLabel>,
  options: { force?: boolean } = {},
): SiteLabel[] {
  const { force = false } = options;
  const uniqueLabels = [...new Set(targetLabels)].filter((label) => siteMap.has(label));
  if (force) {
    return uniqueLabels.filter((label) => !pendingSiteAvailability.has(label));
  }
  return uniqueLabels.filter(
    (label) => !siteAvailability.has(label) && !pendingSiteAvailability.has(label),
  );
}

export function applyAvailabilityResults(
  labels: SiteLabel[],
  results: Array<{ label: SiteLabel; available: boolean; message?: string }> | null | undefined,
  fallbackMessage = "不可访问",
): Map<SiteLabel, AvailabilityRecord> {
  const resultMap = new Map(
    (Array.isArray(results) ? results : []).map((result) => [result.label, result]),
  );

  return new Map(
    labels.map((label) => {
      const result = resultMap.get(label);
      return [
        label,
        {
          available: !!result?.available,
          message: result?.message || (result ? "" : fallbackMessage),
          verifiedByWebview: false,
        },
      ];
    }),
  );
}

export function markAvailabilityFromWebview(
  siteAvailability: Map<SiteLabel, AvailabilityRecord>,
  label: SiteLabel,
  available: boolean,
  message = "",
): AvailabilityRecord {
  const current = getSiteAvailability(siteAvailability, label);
  return {
    ...current,
    available,
    message: available ? "" : (message || current?.message || "不可访问"),
    verifiedByWebview: true,
  };
}

export function sanitizeAvailabilityRecord(label: SiteLabel, value: unknown): AvailabilityRecord | null {
  if (!label || typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Partial<AvailabilityRecord>;
  return {
    available: record.available === true,
    message: record.available === true
      ? ""
      : (typeof record.message === "string" && record.message) || "不可访问",
    verifiedByWebview: record.verifiedByWebview === true,
    checkedAt: Number.isFinite(record.checkedAt) ? record.checkedAt as number : null,
  };
}

export function loadSiteAvailability(storage: StorageLike, storageKey: string): Map<SiteLabel, AvailabilityRecord> {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return new Map();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return new Map();
    }

    return new Map(
      Object.entries(parsed)
        .map(([label, value]) => [label, sanitizeAvailabilityRecord(label, value)] as const)
        .filter((entry): entry is readonly [SiteLabel, AvailabilityRecord] => Boolean(entry[1])),
    );
  } catch (_error) {
    return new Map();
  }
}

export function persistSiteAvailability(
  storage: StorageLike,
  storageKey: string,
  siteAvailability: Map<SiteLabel, AvailabilityRecord>,
  knownLabels: Set<SiteLabel>,
  now: () => number = Date.now,
): void {
  const payload = Object.fromEntries(
    [...siteAvailability.entries()]
      .filter(([label]) => knownLabels.has(label))
      .map(([label, value]) => [
        label,
        {
          available: value.available === true,
          message: value.available === true ? "" : value.message || "不可访问",
          verifiedByWebview: value.verifiedByWebview === true,
          checkedAt: Number.isFinite(value.checkedAt) ? value.checkedAt : now(),
        },
      ]),
  );

  try {
    storage.setItem(storageKey, JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage errors and continue.
  }
}
