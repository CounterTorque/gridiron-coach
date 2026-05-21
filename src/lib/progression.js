const STORAGE_KEY = 'gridiron_mastery';
const WINDOW_SIZE = 10; // rolling window per bucket

export const BUCKETS = {
  first_10:     { label: '1st & 10',    drillIds: ['stacked_box_read', 'red_zone_call', 'stop_the_run', 'balanced_read'] },
  second_short: { label: '2nd & Short', drillIds: ['short_yardage'] },
  second_long:  { label: '2nd & Long',  drillIds: ['spread_coverage', 'third_long'] },
  third_short:  { label: '3rd & Short', drillIds: ['short_yardage', 'goal_line_punch', 'goal_line_stand'] },
  third_long:   { label: '3rd & Long',  drillIds: ['third_long', 'blitz_beater'] },
  fourth_down:  { label: '4th Down',    drillIds: ['goal_line_punch'] },
  red_zone:     { label: 'Red Zone',    drillIds: ['goal_line_punch', 'red_zone_call', 'goal_line_stand'] },
};

export function getSituationBucket(situation) {
  const { down, distance, fieldPosition } = situation;
  if (fieldPosition >= 80) return 'red_zone';
  if (down === 4) return 'fourth_down';
  if (down === 1) return 'first_10';
  if (down === 2 && distance <= 3) return 'second_short';
  if (down === 2) return 'second_long';
  if (down === 3 && distance <= 3) return 'third_short';
  return 'third_long';
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); }
  catch { return {}; }
}

export function recordPlay(situation, score) {
  const bucket = getSituationBucket(situation);
  const data = load();
  if (!data[bucket]) data[bucket] = [];
  data[bucket] = [...data[bucket], score].slice(-WINDOW_SIZE);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function avg(scores) {
  if (!scores?.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function getMasteryAll() {
  const data = load();
  return Object.entries(BUCKETS).map(([id, meta]) => {
    const scores = data[id] ?? [];
    return { id, label: meta.label, avg: avg(scores), count: scores.length, drillIds: meta.drillIds };
  });
}

export function getOverallAvg() {
  const data = load();
  const all = Object.values(data).flat();
  return all.length ? avg(all) : null;
}

export function getRecommendedDrillIds(threshold = 55, minSamples = 3) {
  const ids = new Set();
  for (const b of getMasteryAll()) {
    if (b.count >= minSamples && b.avg !== null && b.avg < threshold) {
      for (const id of b.drillIds) ids.add(id);
    }
  }
  return ids;
}

export function resetMastery() {
  localStorage.removeItem(STORAGE_KEY);
}
