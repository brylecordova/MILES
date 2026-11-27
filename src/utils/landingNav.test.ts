import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANDING_NAV_ITEMS,
  computeActiveLandingSection,
  type SectionPosition,
} from './landingNav';

const SAMPLE_POSITIONS: SectionPosition[] = [
  { id: 'capabilities', top: 680 },
  { id: 'courses', top: 1320 },
  { id: 'certificates', top: 2150 },
  { id: 'verify', top: 2880 },
  { id: 'get-app', top: 3560 },
];

test('defaults to first navigation tab at top of page', () => {
  const active = computeActiveLandingSection({
    scrollY: 0,
    innerHeight: 900,
    docHeight: 4200,
    sectionPositions: SAMPLE_POSITIONS,
  });
  assert.equal(active, LANDING_NAV_ITEMS[0].id);
});

test('selects matching section as viewport scrolls past trigger offset', () => {
  assert.equal(
    computeActiveLandingSection({
      scrollY: 1200,
      innerHeight: 900,
      docHeight: 4200,
      sectionPositions: SAMPLE_POSITIONS,
    }),
    'courses'
  );

  assert.equal(
    computeActiveLandingSection({
      scrollY: 2760,
      innerHeight: 900,
      docHeight: 4200,
      sectionPositions: SAMPLE_POSITIONS,
    }),
    'verify'
  );
});

test('selects final navigation tab when scrolled to bottom of page', () => {
  const active = computeActiveLandingSection({
    scrollY: 3285,
    innerHeight: 900,
    docHeight: 4200,
    sectionPositions: SAMPLE_POSITIONS,
  });
  assert.equal(active, 'get-app');
});

test('handles empty section positions safely', () => {
  const active = computeActiveLandingSection({
    scrollY: 200,
    innerHeight: 900,
    docHeight: 2000,
    sectionPositions: [],
  });
  assert.equal(active, 'capabilities');
});
