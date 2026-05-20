import matchupsData from '../data/matchups.json';
import playsData from '../data/plays.json';
import formationsData from '../data/formations.json';

export function getFormationById(id) {
  return formationsData.find(f => f.id === id) ?? null;
}

export function getPlayById(side, formationId, playId) {
  const plays = side === 'offense' ? getOffensePlays(formationId) : getDefensePlays(formationId);
  return plays.find(p => p.id === playId) ?? null;
}

function randn() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function getOffensePlays(formationId) {
  return playsData.offense[formationId] ?? [];
}

export function getDefensePlays(formationId) {
  return playsData.defense[formationId] ?? [];
}

export function getOffenseFormations() {
  return formationsData.filter(f => f.side === 'offense');
}

export function getDefenseFormations() {
  return formationsData.filter(f => f.side === 'defense');
}

export function generateSituation() {
  const downWeights = [1, 1, 1, 2, 2, 3, 4];
  const down = downWeights[Math.floor(Math.random() * downWeights.length)];

  let distance;
  if (down === 1) {
    distance = 10;
  } else if (down === 4) {
    distance = Math.floor(Math.random() * 4) + 1;
  } else {
    distance = Math.floor(Math.random() * 12) + 1;
  }

  const fieldPosition = Math.floor(Math.random() * 50) + 15;

  return { down, distance, fieldPosition };
}

export function pickAIFormation(side) {
  const formations = side === 'offense' ? getOffenseFormations() : getDefenseFormations();
  return formations[Math.floor(Math.random() * formations.length)];
}

export function pickAIPlay(formationId, side) {
  const plays = side === 'offense' ? getOffensePlays(formationId) : getDefensePlays(formationId);
  if (!plays.length) return null;
  return plays[Math.floor(Math.random() * plays.length)];
}

function getStats(offFormationId, offPlayId, defFormationId, defPlayId) {
  const baseKey = `${offFormationId}_vs_${defFormationId}`;
  const base = matchupsData.base[baseKey] ?? {
    mean_yards: 5.0,
    stdev: 4.5,
    turnover_chance: 0.08,
    big_play_chance: 0.08
  };

  const offMod = matchupsData.off_play_mods[offPlayId] ?? {};
  const defMod = matchupsData.def_play_mods[defPlayId] ?? {};

  return {
    mean:    base.mean_yards      + (offMod.yards_delta   ?? 0) + (defMod.yards_delta   ?? 0),
    stdev:   base.stdev           * (offMod.stdev_mult    ?? 1) * (defMod.stdev_mult    ?? 1),
    turnover: Math.max(0, Math.min(0.4,
      base.turnover_chance  + (offMod.turnover_delta ?? 0) + (defMod.turnover_delta ?? 0)
    )),
    big_play: Math.max(0, Math.min(0.5,
      base.big_play_chance  + (offMod.big_play_delta ?? 0) + (defMod.big_play_delta ?? 0)
    ))
  };
}

function computeDecisionScore(offFormationId, offPlayId, defFormationId, defPlayId, playerSide) {
  if (playerSide === 'offense') {
    const plays = getOffensePlays(offFormationId);
    if (!plays.length) return 50;
    const allMeans = plays.map(p => getStats(offFormationId, p.id, defFormationId, defPlayId).mean);
    const avg = allMeans.reduce((a, b) => a + b, 0) / allMeans.length;
    const mine = getStats(offFormationId, offPlayId, defFormationId, defPlayId).mean;
    return Math.round(Math.min(100, Math.max(0, 50 + (mine - avg) * 8)));
  } else {
    const plays = getDefensePlays(defFormationId);
    if (!plays.length) return 50;
    const allMeans = plays.map(p => getStats(offFormationId, offPlayId, defFormationId, p.id).mean);
    const avg = allMeans.reduce((a, b) => a + b, 0) / allMeans.length;
    const mine = getStats(offFormationId, offPlayId, defFormationId, defPlayId).mean;
    // For defense: lower mean is better, so invert
    return Math.round(Math.min(100, Math.max(0, 50 + (avg - mine) * 8)));
  }
}

function buildBreakdown(outcomeType, offFormationId, offPlayId, defFormationId, defPlayId) {
  // Check for specific breakdown override
  const specificKey = `${offPlayId}_vs_${defPlayId}`;
  const specific = matchupsData.specific_breakdowns[specificKey];
  if (specific) return specific.text;

  const offPlay = getOffensePlays(offFormationId).find(p => p.id === offPlayId);
  const defPlay = getDefensePlays(defFormationId).find(p => p.id === defPlayId);

  if (!offPlay || !defPlay) return '';

  const ot = offPlay.type;   // run | pass | option
  const dt = defPlay.type;   // zone | man | pressure | run_stop | hybrid

  const templates = {
    turnover: {
      pass_pressure: 'The blitz got home clean — QB couldn\'t step into the throw and forced it into coverage.',
      pass_man:      'Tight coverage left no room for error. The pass went up for grabs.',
      run_run_stop:  'The pile collapsed backward — the ball came loose at the point of attack.',
      default:       'Defensive pressure forced a costly mistake at the worst moment.'
    },
    stuff: {
      run_run_stop:  `The ${defPlay.name} was designed for exactly this — every gap filled before the runner could cut.`,
      run_pressure:  'The blitz hit the backfield before the run could develop. Nowhere to go.',
      pass_pressure: `The ${defPlay.name} got home before the QB could step up. Sack.`,
      pass_zone:     'The zone took away every window — QB held too long and ate the pressure.',
      default:       'The defense had the right answer. Offense couldn\'t find a crease.'
    },
    short: {
      run_run_stop:  'Gained a couple, but the box was too crowded to find a real crease.',
      run_zone:      'Defense read the play and rallied to the ball — gain, but not enough.',
      pass_pressure: 'Quick release got the ball out, but the underneath coverage limited it.',
      pass_zone:     'Zone took away the first-down route. Checkdown for a few.',
      default:       'A small gain — not enough to move the chains but keeps the drive going.'
    },
    gain: {
      run_zone:      'Defense was in a passing shell — the run found the extra space in the box.',
      run_man:       'One-on-one in the backfield with a head of steam. Just enough.',
      pass_zone:     'Found the soft spot in the zone — first down.',
      pass_man:      'Receiver won the one-on-one matchup and got open.',
      pass_pressure: 'Quick release beat the blitz. First down.',
      default:       'Good execution from the offense — won this matchup cleanly.'
    },
    big_play: {
      run_zone:      'Defense was in a passing shell — the run cut back against the grain for a massive gain.',
      pass_pressure: 'The aggressive rush left single coverage on the outside with no help. Perfect time to attack.',
      pass_zone:     'Found the vertical seam behind the zone — safety couldn\'t close in time.',
      pass_man:      'Receiver beat the corner off the line. Nobody was home over the top.',
      run_man:       'Defense loaded up for a pass. The run hit untouched.',
      default:       'The offense got exactly what it wanted — defense was in the wrong call.'
    }
  };

  const bucket = templates[outcomeType] ?? templates.gain;

  let key;
  if (ot === 'run' || ot === 'option') {
    if (dt === 'run_stop') key = 'run_run_stop';
    else if (dt === 'pressure') key = 'run_pressure';
    else if (dt === 'zone' || dt === 'hybrid') key = 'run_zone';
    else key = 'run_man';
  } else {
    if (dt === 'pressure') key = 'pass_pressure';
    else if (dt === 'zone') key = 'pass_zone';
    else if (dt === 'man') key = 'pass_man';
    else key = 'pass_zone';
  }

  return bucket[key] ?? bucket.default ?? '';
}

export function getBestCall(offFormationId, defFormationId, defPlayId, playerSide) {
  if (playerSide === 'offense') {
    const plays = getOffensePlays(offFormationId);
    if (!plays.length) return null;
    let best = plays[0];
    let bestMean = -Infinity;
    for (const p of plays) {
      const m = getStats(offFormationId, p.id, defFormationId, defPlayId).mean;
      if (m > bestMean) { bestMean = m; best = p; }
    }
    return best;
  } else {
    const plays = getDefensePlays(defFormationId);
    if (!plays.length) return null;
    let best = plays[0];
    let bestMean = Infinity;
    for (const p of plays) {
      const m = getStats(offFormationId, defPlayId, defFormationId, p.id).mean;
      if (m < bestMean) { bestMean = m; best = p; }
    }
    return best;
  }
}

export function resolve({ offFormationId, offPlayId, defFormationId, defPlayId, playerSide, situation }) {
  const stats = getStats(offFormationId, offPlayId, defFormationId, defPlayId);

  const turnover = Math.random() < stats.turnover;
  if (turnover) {
    return {
      yards: -5,
      turnover: true,
      outcome_type: 'turnover',
      breakdown: buildBreakdown('turnover', offFormationId, offPlayId, defFormationId, defPlayId),
      decision_score: computeDecisionScore(offFormationId, offPlayId, defFormationId, defPlayId, playerSide),
      ai_play_id: defPlayId
    };
  }

  let yards = Math.round(stats.mean + stats.stdev * randn());
  yards = Math.max(-8, Math.min(65, yards));

  // Big play override
  if (Math.random() < stats.big_play && yards < 15) {
    yards = Math.round(15 + Math.random() * 30);
  }

  const outcome_type = yards <= 0 ? 'stuff' : yards <= 3 ? 'short' : yards <= 14 ? 'gain' : 'big_play';

  return {
    yards,
    turnover: false,
    outcome_type,
    breakdown: buildBreakdown(outcome_type, offFormationId, offPlayId, defFormationId, defPlayId),
    decision_score: computeDecisionScore(offFormationId, offPlayId, defFormationId, defPlayId, playerSide),
    ai_play_id: defPlayId
  };
}
