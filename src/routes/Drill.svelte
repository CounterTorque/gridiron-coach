<script>
  import { tick } from 'svelte';
  import FormationField from '../lib/components/FormationField.svelte';
  import BreakdownText from '../lib/components/BreakdownText.svelte';
  import { recordPlay, getRecommendedDrillIds } from '../lib/progression.js';
  import {
    getOffensePlays, getDefensePlays,
    getOffenseFormations, getDefenseFormations,
    getFormationById, pickAIPlay, resolve, getBestCall
  } from '../lib/matchup.js';

  // ── Drill data ───────────────────────────────────────────────
  const DRILLS = [
    {
      id: 'stacked_box_read',
      concept: 'Reading a Stacked Box',
      description: '1st & 10 from your own 40. The defense has loaded 8 defenders near the line.',
      side: 'offense',
      situation: { down: 1, distance: 10, fieldPosition: 40 },
      opponentFormationId: 'stacked_box',
      teachingPoint: 'A stacked box dares you to run. More defenders than blockers means the run will be stuffed — but that thin secondary behind them is exactly the vulnerability to attack with a spread passing formation.'
    },
    {
      id: 'third_long',
      concept: '3rd & Long',
      description: '3rd & 11 from your own 28. Both teams know you almost certainly have to pass.',
      side: 'offense',
      situation: { down: 3, distance: 11, fieldPosition: 28 },
      opponentFormationId: 'nickel',
      teachingPoint: 'On 3rd & long, the defense sub in extra DBs (nickel/dime) because they know you need to pass. Match them with a spread formation that creates route options across the field.'
    },
    {
      id: 'stop_the_run',
      concept: 'Defending the Power Run',
      description: '1st & 10. The offense has lined up in I-Formation — the signature power run set.',
      side: 'defense',
      situation: { down: 1, distance: 10, fieldPosition: 55 },
      opponentFormationId: 'i_formation',
      teachingPoint: 'Two backs in the backfield (FB + RB) is a power run tell. Match numbers at the point of attack by loading the box. A balanced 4-3 can be exploited — a stacked box shuts down the run lanes.'
    },
    {
      id: 'spread_coverage',
      concept: 'Matching a Spread Formation',
      description: '2nd & 7. The offense has spread 3 receivers to one side, flooding your coverage.',
      side: 'defense',
      situation: { down: 2, distance: 7, fieldPosition: 50 },
      opponentFormationId: 'shotgun_trips',
      teachingPoint: 'Three receivers vs. two corners is an instant coverage mismatch. Sub in a nickelback (3rd corner) to match their personnel. A base 4-3 leaves a linebacker covering a wide receiver in space — a disaster.'
    },
    {
      id: 'goal_line_punch',
      concept: 'Goal Line Offense',
      description: '4th & 1 at the opponent\'s 1-yard line. Score or turn it over.',
      side: 'offense',
      situation: { down: 4, distance: 1, fieldPosition: 99 },
      opponentFormationId: 'goal_line_def',
      teachingPoint: 'One yard is a battle of leverage. The defense knows what\'s coming — match power with power. Goal Line formation maximizes blockers at the point of attack and creates double-team angles at the line.'
    },
    {
      id: 'blitz_beater',
      concept: 'Beating the Blitz',
      description: '3rd & 6. The defense is showing pressure — extra rushers are coming.',
      side: 'offense',
      situation: { down: 3, distance: 6, fieldPosition: 42 },
      opponentFormationId: 'stacked_box',
      teachingPoint: 'A blitz sends extra rushers. The antidote: get the ball out before they arrive. Screen passes and quick slants exploit the aggressive rush — the ball is out fast and blockers are already set up in space.'
    },
    {
      id: 'red_zone_call',
      concept: 'Red Zone Offense',
      description: '1st & 10 from the opponent\'s 14. The field compresses — deep routes lose value.',
      side: 'offense',
      situation: { down: 1, distance: 10, fieldPosition: 86 },
      opponentFormationId: 'nickel',
      teachingPoint: 'In the red zone, the field shrinks and cover-2 zones become more effective — there\'s less room to attack deep. Quick, precise routes to the end zone and power runs that create leverage work better than vertical concepts.'
    },
    {
      id: 'short_yardage',
      concept: 'Short Yardage Run',
      description: '3rd & 2 from midfield. Two yards. The base defense isn\'t loaded for short-yardage.',
      side: 'offense',
      situation: { down: 3, distance: 2, fieldPosition: 50 },
      opponentFormationId: 'four_three',
      teachingPoint: 'Short yardage is a numbers game at the line. The 4-3 is balanced but not packed for short-yardage — a power formation with a fullback (or extra TE) creates the blocking angles to get those 2 yards.'
    },
    {
      id: 'goal_line_stand',
      concept: 'Goal Line Defense',
      description: '3rd & 2 at your own 2-yard line. Give up the touchdown and the game changes.',
      side: 'defense',
      situation: { down: 3, distance: 2, fieldPosition: 98 },
      opponentFormationId: 'goal_line_off',
      teachingPoint: 'Five defensive linemen clog every A, B, and C gap. The compressed field also limits passing angles. This is the defense designed for one job: stop the run at the goal line with maximum bodies at the point of attack.'
    },
    {
      id: 'balanced_read',
      concept: 'Reading a Balanced Formation',
      description: '1st & 10. The offense is in Singleback — equal run/pass threat. Stay honest.',
      side: 'defense',
      situation: { down: 1, distance: 10, fieldPosition: 45 },
      opponentFormationId: 'singleback',
      teachingPoint: 'Singleback is designed to create ambiguity — it can run or pass with equal effectiveness. Committing to stopping one thing opens the other. Your base 4-3 stays honest against both, which is exactly right on 1st & 10.'
    }
  ];

  // ── State ────────────────────────────────────────────────────
  let drillIndex = 0;
  let phase = 'call'; // 'call' | 'resolved'
  let selectedFormationId = null;
  let selectedPlayId = null;
  let result = null;
  let opponentPlayId = null;
  let resultEl = null;

  // Persistent: which drills have been completed
  let completed = new Set(
    JSON.parse(localStorage.getItem('drill_completed') ?? '[]')
  );

  function saveCompleted() {
    localStorage.setItem('drill_completed', JSON.stringify([...completed]));
  }

  // Mastery-based recommendations (recomputed when drillIndex or phase changes)
  let recommendedIds = getRecommendedDrillIds();
  $: isRecommended = recommendedIds.has(drill?.id);

  // ── Derived ──────────────────────────────────────────────────
  $: drill = DRILLS[drillIndex];
  $: opponentFormation = drill ? getFormationById(drill.opponentFormationId) : null;
  $: playerFormations = drill?.side === 'offense' ? getOffenseFormations() : getDefenseFormations();
  $: playerPlays = selectedFormationId
    ? (drill.side === 'offense' ? getOffensePlays(selectedFormationId) : getDefensePlays(selectedFormationId))
    : [];

  $: oppRevealPlays = result && drill
    ? (drill.side === 'offense' ? getDefensePlays(drill.opponentFormationId) : getOffensePlays(drill.opponentFormationId))
    : [];
  $: oppPlay = oppRevealPlays.find(p => p.id === opponentPlayId);

  $: scoreClass = result
    ? result.decision_score >= 70 ? 'excellent'
    : result.decision_score >= 50 ? 'good'
    : 'poor'
    : '';

  $: scoreLabel = result
    ? result.decision_score >= 70 ? 'CORRECT CALL'
    : result.decision_score >= 50 ? 'DECENT CALL'
    : 'SUBOPTIMAL'
    : '';

  $: bestCall = result && result.decision_score < 70 && selectedFormationId
    ? getBestCall(
        drill.side === 'offense' ? selectedFormationId : opponentFormation?.id,
        drill.side === 'offense' ? opponentFormation?.id : selectedFormationId,
        opponentPlayId,
        drill.side
      )
    : null;

  // ── Actions ──────────────────────────────────────────────────
  function selectFormation(id) {
    selectedFormationId = id;
    selectedPlayId = null;
  }

  async function runPlay() {
    if (!selectedFormationId || !selectedPlayId || !opponentFormation) return;

    const aiPlay = pickAIPlay(
      opponentFormation.id,
      drill.side === 'offense' ? 'defense' : 'offense'
    );
    opponentPlayId = aiPlay?.id ?? null;

    const offFId = drill.side === 'offense' ? selectedFormationId : opponentFormation.id;
    const offPId = drill.side === 'offense' ? selectedPlayId      : opponentPlayId;
    const defFId = drill.side === 'defense' ? selectedFormationId : opponentFormation.id;
    const defPId = drill.side === 'defense' ? selectedPlayId      : opponentPlayId;

    result = resolve({
      offFormationId: offFId, offPlayId: offPId,
      defFormationId: defFId, defPlayId: defPId,
      playerSide: drill.side,
      situation: drill.situation
    });

    completed.add(drill.id);
    completed = completed;
    saveCompleted();
    recordPlay(drill.situation, result.decision_score);
    recommendedIds = getRecommendedDrillIds();
    phase = 'resolved';
    await tick();
    resultEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function nextDrill() {
    drillIndex = (drillIndex + 1) % DRILLS.length;
    reset();
  }

  function prevDrill() {
    drillIndex = (drillIndex - 1 + DRILLS.length) % DRILLS.length;
    reset();
  }

  function reset() {
    selectedFormationId = null;
    selectedPlayId = null;
    result = null;
    opponentPlayId = null;
    phase = 'call';
  }

  function goToDrill(i) {
    drillIndex = i;
    reset();
  }

  $: downStr = ['','1st','2nd','3rd','4th'][drill?.situation.down] ?? '';
  $: fieldStr = drill?.situation.fieldPosition <= 50
    ? `OWN ${drill.situation.fieldPosition}`
    : `OPP ${100 - drill.situation.fieldPosition}`;
</script>

<div class="drill-wrap">

  <!-- Drill nav header -->
  <div class="drill-header">
    <button class="arrow-btn" onclick={prevDrill} title="Previous drill">‹</button>
    <div class="drill-meta">
      <div class="drill-concept-row">
        <div class="drill-concept">{drill.concept}</div>
        {#if isRecommended}
          <span class="rec-badge" title="Recommended based on your mastery data">RECOMMENDED</span>
        {/if}
      </div>
      <div class="drill-counter">
        {#each DRILLS as d, i}
          <button
            class="dot-btn"
            class:active={i === drillIndex}
            class:done={completed.has(d.id)}
            onclick={() => goToDrill(i)}
            title={d.concept}
          ></button>
        {/each}
      </div>
    </div>
    <button class="arrow-btn" onclick={nextDrill} title="Next drill">›</button>
  </div>

  <!-- Situation strip -->
  <div class="sit-bar">
    <div class="sit-chip">
      <span class="sit-lbl">SIDE</span>
      <span class="sit-val" class:off={drill.side === 'offense'} class:def={drill.side === 'defense'}>
        {drill.side === 'offense' ? 'OFFENSE' : 'DEFENSE'}
      </span>
    </div>
    <div class="sit-chip">
      <span class="sit-lbl">DOWN</span>
      <span class="sit-val">{downStr} &amp; {drill.situation.distance}</span>
    </div>
    <div class="sit-chip">
      <span class="sit-lbl">FIELD POS</span>
      <span class="sit-val">{fieldStr}</span>
    </div>
    <div class="sit-desc">{drill.description}</div>
  </div>

  <!-- Main layout -->
  <div class="drill-body">

    <!-- Opponent panel -->
    <div class="opp-panel">
      <div class="panel-label">OPPONENT</div>
      {#if opponentFormation}
        <div class="opp-name">{opponentFormation.name}</div>
        <FormationField formation={opponentFormation} showTells={phase === 'resolved'} compact={true}/>
        <div class="opp-personnel">{opponentFormation.personnelLabel}</div>
        {#if phase === 'call'}
          <div class="tells-hint">Resolve the play to reveal tells</div>
        {/if}
        {#if phase === 'resolved' && oppPlay}
          <div class="ai-reveal">
            <span class="ai-lbl">THEY CALLED:</span>
            <span class="ai-name">{oppPlay.name}</span>
            <span class="ai-tag tag">{oppPlay.tag}</span>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Call panel -->
    <div class="call-panel">
      <div class="panel-label">YOUR CALL</div>

      {#if phase === 'call'}
        <div class="picker-label">Formation</div>
        <div class="formation-grid">
          {#each playerFormations as f}
            <button class="formation-btn" class:selected={selectedFormationId === f.id}
              onclick={() => selectFormation(f.id)}>
              <span class="fbn-name">{f.name}</span>
              <span class="fbn-pers">{f.personnel}</span>
            </button>
          {/each}
        </div>

        {#if playerPlays.length}
          <div class="picker-label" style="margin-top:0.4em">Play</div>
          <div class="play-list">
            {#each playerPlays as play}
              <button class="play-btn" class:selected={selectedPlayId === play.id}
                onclick={() => (selectedPlayId = play.id)}>
                <div class="play-top">
                  <span class="play-name">{play.name}</span>
                  <span class="play-tag tag">{play.tag}</span>
                </div>
                <div class="play-desc">{play.description}</div>
              </button>
            {/each}
          </div>
        {:else}
          <div class="picker-hint">Pick a formation to see plays</div>
        {/if}

        <button class="run-btn" disabled={!selectedFormationId || !selectedPlayId} onclick={runPlay}>
          SUBMIT CALL
        </button>

      {:else}
        <!-- Resolved: show selected call as summary -->
        <div class="call-summary">
          {#if selectedFormationId}
            {@const sf = playerFormations.find(f => f.id === selectedFormationId)}
            {@const sp = playerPlays.find(p => p.id === selectedPlayId)}
            {#if sf}
              <div class="cs-formation">{sf.name}</div>
            {/if}
            {#if sp}
              <div class="cs-play">{sp.name} <span class="tag">{sp.tag}</span></div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Result panel -->
  {#if phase === 'resolved' && result}
    <div class="result-panel" bind:this={resultEl} class:rp-good={result.decision_score >= 70} class:rp-bad={result.decision_score < 50}>
      <div class="result-top">
        <div class="result-yards">
          {#if result.turnover}
            <span class="ry-num neg">TO</span>
          {:else}
            <span class="ry-num" class:pos={result.yards > 0} class:neg={result.yards <= 0}>
              {result.yards > 0 ? '+' : ''}{result.yards}
            </span>
            <span class="ry-unit">yds</span>
          {/if}
        </div>
        <span class="score-badge {scoreClass}">{scoreLabel} · {result.decision_score}/100</span>
        <div class="result-spacer"></div>
        <button class="next-drill-btn" onclick={nextDrill}>Next Drill →</button>
      </div>

      <p class="result-breakdown"><BreakdownText text={result.breakdown} /></p>

      {#if bestCall}
        <div class="better-call">
          <span class="bc-lbl">BETTER CALL:</span>
          <span class="bc-name">{bestCall.name}</span>
          <span class="bc-desc">— {bestCall.description}</span>
        </div>
      {/if}

      <div class="teaching-point">
        <span class="tp-label">TEACHING POINT</span>
        <p class="tp-text">{drill.teachingPoint}</p>
      </div>
    </div>
  {/if}

</div>

<style>
  .drill-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
    padding: 0 1.25rem;
    overflow-y: auto;
    font-size: 25px;
  }

  /* ── Drill header ────────────────────────────────────────── */
  .drill-header {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.4em 0 0.35em;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
  }

  .arrow-btn {
    background: var(--bg);
    border: none;
    border-radius: 5px;
    width: 1.6em;
    height: 1.6em;
    font-size: 0.9em;
    font-weight: 700;
    color: var(--text-muted);
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: box-shadow 0.15s, color 0.15s;
  }

  .arrow-btn:hover { box-shadow: var(--neu-raised); color: var(--text-primary); }

  .drill-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3em;
  }

  .drill-concept-row {
    display: flex;
    align-items: center;
    gap: 0.4em;
  }

  .drill-concept {
    font-size: 0.78em;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: 0.02em;
  }

  .rec-badge {
    font-size: 0.46em;
    font-weight: 700;
    letter-spacing: 0.1em;
    padding: 2px 5px;
    border-radius: 3px;
    background: rgba(176,80,0,0.1);
    color: #b05000;
    border: 1px solid rgba(176,80,0,0.25);
  }

  .drill-counter {
    display: flex;
    gap: 0;
  }

  .dot-btn {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0;
    position: relative;
    flex-shrink: 0;
  }

  .dot-btn::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--border);
    transition: background 0.15s, transform 0.1s;
  }

  .dot-btn.active::after    { background: var(--accent); transform: translate(-50%, -50%) scale(1.25); }
  .dot-btn.done:not(.active)::after { background: var(--accent-muted); opacity: 0.6; }
  .dot-btn:hover::after     { background: var(--accent-muted); }

  /* ── Situation strip ──────────────────────────────────────── */
  .sit-bar {
    display: flex;
    align-items: center;
    gap: 0.8em;
    padding: 0.3em 0;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .sit-chip {
    display: flex;
    align-items: baseline;
    gap: 0.3em;
  }

  .sit-lbl {
    font-size: 0.56em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .sit-val {
    font-size: 0.8em;
    font-weight: 700;
    font-family: monospace;
    color: var(--accent);
  }

  .sit-val.off { color: var(--off-accent); }
  .sit-val.def { color: var(--accent); }

  .sit-desc {
    font-size: 0.65em;
    color: var(--text-secondary);
    flex: 1;
    min-width: 0;
  }

  /* ── Main body ────────────────────────────────────────────── */
  .drill-body {
    display: grid;
    grid-template-columns: 11.875em 1fr;
    gap: 1em;
    padding-top: 0.5em;
    flex-shrink: 0;
  }

  /* ── Opponent panel ──────────────────────────────────────── */
  .opp-panel {
    display: flex;
    flex-direction: column;
    gap: 0.35em;
  }

  .panel-label {
    font-size: 0.58em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .opp-name {
    font-size: 0.82em;
    font-weight: 700;
    color: var(--text-primary);
  }

  .opp-personnel {
    font-size: 0.62em;
    font-weight: 600;
    color: var(--text-muted);
  }

  .tells-hint {
    font-size: 0.6em;
    color: var(--text-muted);
    font-style: italic;
  }

  .ai-reveal {
    display: flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.28em 0.5em;
    background: var(--bg);
    border-radius: 5px;
    box-shadow: var(--neu-raised-sm);
  }

  .ai-lbl  { font-size: 0.54em; font-weight: 700; letter-spacing: 0.08em; color: var(--text-muted); }
  .ai-name { font-size: 0.72em; font-weight: 600; color: var(--text-primary); }
  .ai-tag  { }

  /* ── Call panel ───────────────────────────────────────────── */
  .call-panel {
    display: flex;
    flex-direction: column;
    gap: 0.45em;
  }

  .picker-label {
    font-size: 0.58em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .formation-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.28em;
  }

  .formation-btn {
    background: var(--bg);
    border: none;
    border-radius: 6px;
    padding: 0.35em 0.55em;
    text-align: left;
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.15s;
    display: flex;
    align-items: baseline;
    gap: 0.35em;
  }

  .formation-btn:hover { box-shadow: var(--neu-raised); }
  .formation-btn.selected { box-shadow: var(--neu-inset-sm); outline: 2px solid var(--accent); outline-offset: -2px; }

  .fbn-name { font-size: 0.74em; font-weight: 700; color: var(--text-primary); }
  .fbn-pers { font-size: 0.58em; color: var(--text-muted); font-family: monospace; }

  .play-list { display: flex; flex-direction: column; gap: 0.2em; }

  .play-btn {
    background: var(--bg);
    border: none;
    border-radius: 6px;
    padding: 0.28em 0.6em;
    text-align: left;
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.15s;
    display: flex;
    flex-direction: column;
    gap: 0.08em;
  }

  .play-btn:hover { box-shadow: var(--neu-raised); }
  .play-btn.selected { box-shadow: var(--neu-inset-sm); outline: 2px solid var(--accent); outline-offset: -2px; }

  .play-top { display: flex; align-items: center; gap: 0.35em; }
  .play-name { font-size: 0.76em; font-weight: 700; color: var(--text-primary); }
  .play-desc { font-size: 0.62em; color: var(--text-muted); line-height: 1.3; }

  .picker-hint { font-size: 0.7em; color: var(--text-muted); padding: 0.2em 0; }

  .tag {
    font-size: 0.54em;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 1px 5px;
    border-radius: 3px;
    color: var(--text-muted);
    background: var(--bg);
    box-shadow: var(--neu-inset-sm);
  }

  .run-btn {
    background: var(--accent);
    border: none;
    border-radius: 7px;
    padding: 0.45em 0.9em;
    font-size: 0.76em;
    font-weight: 800;
    letter-spacing: 0.08em;
    font-family: inherit;
    color: #fff;
    cursor: pointer;
    margin-top: 0.2em;
    box-shadow: 0 4px 12px rgba(13,35,71,0.4);
    transition: box-shadow 0.15s, transform 0.05s;
  }

  .run-btn:hover:not(:disabled) { box-shadow: 0 5px 16px rgba(13,35,71,0.5); transform: translateY(-1px); }
  .run-btn:active:not(:disabled) { transform: translateY(0); }
  .run-btn:disabled { opacity: 0.35; cursor: default; }

  .call-summary {
    display: flex;
    flex-direction: column;
    gap: 0.3em;
  }

  .cs-formation { font-size: 0.88em; font-weight: 700; color: var(--text-primary); }
  .cs-play { font-size: 0.76em; color: var(--text-secondary); display: flex; align-items: center; gap: 0.4em; }

  /* ── Result panel ─────────────────────────────────────────── */
  .result-panel {
    background: var(--bg);
    border-radius: 10px;
    padding: 0.65em 0.9em;
    margin-top: 0.4em;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35em;
    box-shadow: var(--neu-raised);
  }

  .result-panel.rp-good { box-shadow: var(--neu-raised), inset 0 3px 0 rgba(26,122,60,0.45); }
  .result-panel.rp-bad  { box-shadow: var(--neu-raised), inset 0 3px 0 rgba(176,40,32,0.35); }

  .result-top {
    display: flex;
    align-items: center;
    gap: 0.75em;
  }

  .result-yards {
    display: flex;
    align-items: baseline;
    gap: 0.2em;
    flex-shrink: 0;
  }

  .ry-num {
    font-size: 1.5em;
    font-weight: 900;
    font-family: monospace;
    line-height: 1;
    color: var(--off-accent);
  }

  .ry-num.pos { color: var(--off-accent); }
  .ry-num.neg { color: #c44; }
  .ry-unit { font-size: 0.72em; font-weight: 600; color: var(--text-muted); }

  .score-badge {
    font-size: 0.62em;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .score-badge.excellent { background: rgba(26,122,60,0.1);  color: #1a7a3c; border: 1px solid rgba(26,122,60,0.3); }
  .score-badge.good      { background: rgba(26,122,60,0.06); color: #2d8a56; border: 1px solid rgba(26,122,60,0.2); }
  .score-badge.poor      { background: rgba(176,40,32,0.1);  color: #b02820; border: 1px solid rgba(176,40,32,0.2); }

  .result-spacer { flex: 1; }

  .next-drill-btn {
    background: var(--bg);
    border: none;
    border-radius: 6px;
    padding: 0.32em 0.8em;
    font-size: 0.7em;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-primary);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.15s;
  }

  .next-drill-btn:hover { box-shadow: var(--neu-raised); }

  .result-breakdown {
    font-size: 0.74em;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .better-call {
    font-size: 0.68em;
    color: var(--text-secondary);
    display: flex;
    align-items: baseline;
    gap: 0.3em;
    flex-wrap: wrap;
  }

  .bc-lbl  { font-size: 0.58em; font-weight: 700; letter-spacing: 0.08em; color: var(--text-muted); }
  .bc-name { font-weight: 700; color: var(--text-primary); }
  .bc-desc { color: var(--text-muted); }

  .teaching-point {
    padding: 0.45em 0.65em;
    background: rgba(13,35,71,0.04);
    border-left: 2px solid var(--accent-muted);
    border-radius: 0 5px 5px 0;
    display: flex;
    flex-direction: column;
    gap: 0.2em;
  }

  .tp-label {
    font-size: 0.52em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--accent-muted);
  }

  .tp-text {
    font-size: 0.7em;
    color: var(--text-secondary);
    line-height: 1.55;
    margin: 0;
  }
</style>
