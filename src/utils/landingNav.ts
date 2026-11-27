export type LandingSectionId =
  | 'capabilities'
  | 'courses'
  | 'certificates'
  | 'verify'
  | 'get-app';

export interface LandingNavItem {
  id: LandingSectionId;
  label: string;
}

export const LANDING_NAV_ITEMS: readonly LandingNavItem[] = [
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'courses', label: 'Course Catalog' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'verify', label: 'Verify' },
  { id: 'get-app', label: 'Android App' },
] as const;

export interface SectionPosition {
  id: LandingSectionId;
  top: number;
}

export interface ComputeActiveSectionInput {
  scrollY: number;
  innerHeight: number;
  docHeight: number;
  sectionPositions: SectionPosition[];
  triggerOffset?: number;
}

export function computeActiveLandingSection({
  scrollY,
  innerHeight,
  docHeight,
  sectionPositions,
  triggerOffset = 140,
}: ComputeActiveSectionInput): LandingSectionId {
  if (sectionPositions.length === 0) {
    return LANDING_NAV_ITEMS[0].id;
  }

  const ordered = [...sectionPositions].sort((a, b) => a.top - b.top);

  if (docHeight > 0 && innerHeight > 0 && scrollY + innerHeight >= docHeight - 24) {
    return ordered[ordered.length - 1].id;
  }

  const threshold = scrollY + triggerOffset;
  let active = ordered[0].id;
  for (const section of ordered) {
    if (section.top <= threshold) {
      active = section.id;
    } else {
      break;
    }
  }

  return active;
}
