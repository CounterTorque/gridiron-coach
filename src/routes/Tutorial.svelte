<script>
  import { createEventDispatcher } from 'svelte';
  import FormationField from '../lib/components/FormationField.svelte';
  import {
    getOffensePlays, getDefensePlays,
    getOffenseFormations, getDefenseFormations,
    getFormationById, pickAIPlay, resolve
  } from '../lib/matchup.js';

  const dispatch = createEventDispatcher();

  // ── Step data ────────────────────────────────────────────────
  const STEPS = [
    {
      id: 'welcome', type: 'text',
      title: 'Welcome to Gridiron Coach',
      paras: [
        'Football is a game of matchups. Every play is a chess match — the offense tries to exploit the defense\'s alignment, and the defense tries to take away what the offense does best.',
        'This tutorial covers the essentials: positions, formations, down & distance. You\'ll make your first offensive and defensive calls before heading into Coach Mode.',
      ]
    },
    {
      id: 'field', type: 'field_diagram',
      title: 'The Field',
      paras: [
        'A 100-yard field. The line of scrimmage (LOS) is where play begins each down — neither team can cross it until the ball is snapped.',
        'The offense lines up behind the LOS and tries to advance 10 yards per set of downs. The defense lines up across it and tries to stop them.',
      ]
    },
    {
      id: 'offense', type: 'formation',
      formationId: 'i_formation',
      title: 'Offensive Formations',
      paras: [
        'A formation signals intent. Two backs in the backfield say "power run." Three wide receivers say "spread the field and pass."',
        'The I-Formation stacks the QB, fullback, and running back vertically. The FB leads blocks — it\'s a pure power run design.',
      ],
      callout: 'Hover any player to see their role. Click to open the glossary.'
    },
    {
      id: 'defense', type: 'formation',
      formationId: 'four_three',
      title: 'Defensive Formations',
      paras: [
        'The 4-3 is the standard base defense: four linemen, three linebackers, two corners, two safeties. Balanced against run and pass.',
        'When the offense puts 3+ receivers on the field, the defense subs in a nickelback — a fifth defensive back — because a linebacker can\'t cover a fast receiver in open space.',
      ],
      callout: 'Hover each position to see their responsibility.'
    },
    {
      id: 'down_distance', type: 'situation',
      title: 'Down & Distance',
      paras: [
        'The offense gets four downs to gain 10 yards. Gain it and you reset to 1st & 10. Fail and you face 4th down — punt, kick, or gamble.',
        'The situation changes everything. "3rd & 11" is a passing down — both teams know it. "4th & 1" is a test of will.',
      ],
      examples: [
        { label: '1st & 10', note: 'Balanced — run or pass, no pressure.' },
        { label: '2nd & 3',  note: 'Short gain finishes it. Run tends to work.' },
        { label: '3rd & 11', note: 'Pass down. Defense subs DBs. No secrets.' },
        { label: '4th & 1',  note: 'Go for it, punt, or kick. High stakes.' },
      ]
    },
    {
      id: 'play_offense', type: 'guided_play',
      side: 'offense',
      title: 'Your First Offensive Call',
      opponentFormationId: 'stacked_box',
      hint: 'Eight defenders near the line — a stacked box. The run will be stuffed. Their secondary is thin. Attack with a spread passing formation.',
      paras: ['The defense is showing a Stacked Box — they\'ve loaded the line to stop the run. Count the bodies near the LOS. Pick a formation that attacks what they\'ve left undefended.']
    },
    {
      id: 'play_defense', type: 'guided_play',
      side: 'defense',
      title: 'Your First Defensive Call',
      opponentFormationId: 'shotgun_trips',
      hint: 'Three wide receivers in the shotgun. This is a passing formation. Your base 4-3 leaves linebackers chasing fast receivers — you need more defensive backs.',
      paras: ['The offense has spread three receivers. Your two corners can\'t cover all of them. Pick a defensive formation that matches the personnel on the field.']
    },
    {
      id: 'complete', type: 'complete',
      title: 'Ready to Coach',
      paras: [
        'You\'ve seen the pieces: formations, positions, down & distance. Now put it together in Coach Mode.',
        'You\'ll call plays across full drives, earn Decision XP for good calls regardless of the outcome, and see your read improve over time.',
        'One last thing: a good call can still fail. That\'s football. What matters is making the right decision with the information you have.',
      ]
    }
  ];

  // ── Navigation ───────────────────────────────────────────────
  let currentStep = 0;
  $: step = STEPS[currentStep];
  $: isLast = currentStep === STEPS.length - 1;
  $: canAdvance = step.type !== 'guided_play' || guidePhase === 'resolved';

  function next() { if (currentStep < STEPS.length - 1) currentStep++; }
  function back() { if (currentStep > 0) currentStep--; }
  function skip() { dispatch('done'); }
  function finish() { dispatch('done'); }

  // ── Guided play state (resets on step change) ────────────────
  let guideFormationId = null;
  let guidePlayId = null;
  let guideResult = null;
  let guidePhase = 'call';
  let guideOpponentPlayId = null;

  $: if (step) { resetGuide(); }

  function resetGuide() {
    guideFormationId = null;
    guidePlayId = null;
    guideResult = null;
    guidePhase = 'call';
    guideOpponentPlayId = null;
  }

  $: guideOpponentFormation = step?.opponentFormationId
    ? getFormationById(step.opponentFormationId) : null;

  $: guidePlayerFormations = step?.side === 'offense'
    ? getOffenseFormations() : getDefenseFormations();

  $: guidePlays = guideFormationId
    ? (step?.side === 'offense'
        ? getOffensePlays(guideFormationId)
        : getDefensePlays(guideFormationId))
    : [];

  $: guideOppPlays = step?.side === 'offense' && guideOpponentFormation
    ? getDefensePlays(guideOpponentFormation.id)
    : step?.side === 'defense' && guideOpponentFormation
      ? getOffensePlays(guideOpponentFormation.id)
      : [];
  $: guideOppPlay = guideOppPlays.find(p => p.id === guideOpponentPlayId);

  function runGuidePlay() {
    if (!guideFormationId || !guidePlayId || !guideOpponentFormation) return;
    const aiPlay = pickAIPlay(
      guideOpponentFormation.id,
      step.side === 'offense' ? 'defense' : 'offense'
    );
    guideOpponentPlayId = aiPlay?.id ?? null;

    const offFormationId = step.side === 'offense' ? guideFormationId : guideOpponentFormation.id;
    const offPlayId      = step.side === 'offense' ? guidePlayId      : guideOpponentPlayId;
    const defFormationId = step.side === 'defense' ? guideFormationId : guideOpponentFormation.id;
    const defPlayId      = step.side === 'defense' ? guidePlayId      : guideOpponentPlayId;

    guideResult = resolve({
      offFormationId, offPlayId, defFormationId, defPlayId,
      playerSide: step.side,
      situation: { down: 1, distance: 10, fieldPosition: 40 }
    });
    guidePhase = 'resolved';
  }

  $: guideScoreClass = guideResult
    ? guideResult.decision_score >= 70 ? 'excellent'
    : guideResult.decision_score >= 50 ? 'good'
    : 'poor'
    : '';
  $: guideScoreLabel = guideResult
    ? guideResult.decision_score >= 70 ? 'GREAT READ'
    : guideResult.decision_score >= 50 ? 'DECENT CALL'
    : 'BETTER OPTION EXISTS'
    : '';
</script>

<div class="tut-wrap">
  <!-- Header -->
  <div class="tut-header">
    <div class="prog-bar">
      {#each STEPS as s, i}
        <div class="prog-dot" class:active={i === currentStep} class:done={i < currentStep}></div>
      {/each}
    </div>
    <button class="skip-link" onclick={skip}>Skip Tutorial</button>
  </div>

  <!-- Content -->
  <div class="tut-body" class:two-col={step.type === 'formation' || step.type === 'guided_play'}>

    {#if step.type === 'text' || step.type === 'complete'}
      <div class="text-step">
        <h2 class="step-title">{step.title}</h2>
        {#each step.paras as p}<p class="step-para">{p}</p>{/each}
        {#if step.type === 'complete'}
          <button class="cta-btn" onclick={finish}>Enter Coach Mode →</button>
        {/if}
      </div>

    {:else if step.type === 'field_diagram'}
      <div class="text-step">
        <h2 class="step-title">{step.title}</h2>
        {#each step.paras as p}<p class="step-para">{p}</p>{/each}
      </div>
      <div class="field-diagram">
        <!-- Annotated field SVG -->
        <svg viewBox="0 0 100 110" class="diag-svg" aria-label="Football field diagram">
          <rect width="100" height="110" fill="#2d7a3a"/>
          <line x1="0" y1="0"   x2="0"   y2="110" stroke="rgba(255,255,255,0.6)" stroke-width="0.5"/>
          <line x1="100" y1="0" x2="100" y2="110" stroke="rgba(255,255,255,0.6)" stroke-width="0.5"/>
          {#each [10,20,30,40,50,60,70,80,90,100] as yl}
            <line x1="0" y1={yl} x2="100" y2={yl} stroke="rgba(255,255,255,0.22)" stroke-width="0.3"/>
          {/each}
          <!-- End zones -->
          <rect x="0" y="0"   width="100" height="10" fill="rgba(26,122,60,0.35)"/>
          <rect x="0" y="100" width="100" height="10" fill="rgba(13,35,71,0.35)"/>
          <!-- LOS -->
          <line x1="0" y1="60" x2="100" y2="60" stroke="rgba(255,220,0,0.8)" stroke-width="0.7" stroke-dasharray="3,2"/>
          <!-- Labels -->
          <text x="50" y="6"   text-anchor="middle" font-size="3.5" fill="rgba(255,255,255,0.8)" font-family="monospace" font-weight="700">OFFENSE END ZONE</text>
          <text x="50" y="107" text-anchor="middle" font-size="3.5" fill="rgba(255,255,255,0.8)" font-family="monospace" font-weight="700">DEFENSE END ZONE</text>
          <text x="2"  y="58"  font-size="3" fill="rgba(255,220,0,0.9)" font-family="monospace">LOS</text>
          <!-- Yard markers -->
          {#each [[10,'10'],[20,'20'],[30,'30'],[40,'40'],[50,'50'],[60,'40'],[70,'30'],[80,'20'],[90,'10']] as [yl,label]}
            <text x="50" y={yl - 1.5} text-anchor="middle" font-size="2.8" fill="rgba(255,255,255,0.55)" font-family="monospace">{label}</text>
          {/each}
          <!-- Arrows showing direction -->
          <text x="4" y="45" font-size="3" fill="rgba(26,122,60,0.8)" font-family="sans-serif">↑ offense</text>
          <text x="4" y="75" font-size="3" fill="rgba(13,35,71,0.8)" font-family="sans-serif">↓ defense</text>
        </svg>
      </div>

    {:else if step.type === 'formation'}
      <div class="col-left">
        <div class="col-label">{getFormationById(step.formationId)?.side === 'defense' ? 'DEFENSE' : 'OFFENSE'}</div>
        <FormationField formation={getFormationById(step.formationId)} showTells={false} />
        {#if step.callout}
          <div class="callout-box">{step.callout}</div>
        {/if}
      </div>
      <div class="col-right">
        <h2 class="step-title">{step.title}</h2>
        {#each step.paras as p}<p class="step-para">{p}</p>{/each}
        {#if getFormationById(step.formationId)?.tells?.length}
          <div class="tells-preview">
            <div class="tells-hdr">READS</div>
            {#each getFormationById(step.formationId).tells as tell}
              <div class="tell-item">› {tell}</div>
            {/each}
          </div>
        {/if}
      </div>

    {:else if step.type === 'situation'}
      <div class="text-step sit-step">
        <h2 class="step-title">{step.title}</h2>
        {#each step.paras as p}<p class="step-para">{p}</p>{/each}
        <div class="sit-examples">
          {#each step.examples as ex}
            <div class="sit-card">
              <span class="sit-card-label">{ex.label}</span>
              <span class="sit-card-note">{ex.note}</span>
            </div>
          {/each}
        </div>
      </div>

    {:else if step.type === 'guided_play'}
      <!-- Opponent panel -->
      <div class="col-left">
        <div class="col-label">OPPONENT</div>
        {#if guideOpponentFormation}
          <FormationField formation={guideOpponentFormation} showTells={true} compact={true}/>
          <div class="opp-personnel">{guideOpponentFormation.personnelLabel}</div>
          {#if guidePhase === 'resolved' && guideOppPlay}
            <div class="ai-reveal">
              <span class="ai-rev-lbl">THEY CALLED:</span>
              <span class="ai-rev-name">{guideOppPlay.name}</span>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Call panel -->
      <div class="col-right guide-call">
        <h2 class="step-title sm">{step.title}</h2>
        {#each step.paras as p}<p class="step-para sm">{p}</p>{/each}

        <div class="hint-box">{step.hint}</div>

        {#if guidePhase === 'call'}
          <div class="picker-label">Formation</div>
          <div class="formation-grid">
            {#each guidePlayerFormations as f}
              <button class="formation-btn" class:selected={guideFormationId === f.id}
                onclick={() => { guideFormationId = f.id; guidePlayId = null; }}>
                <span class="fbn-name">{f.name}</span>
                <span class="fbn-pers">{f.personnel}</span>
              </button>
            {/each}
          </div>

          {#if guidePlays.length}
            <div class="picker-label" style="margin-top:0.4em">Play</div>
            <div class="play-list">
              {#each guidePlays as play}
                <button class="play-btn" class:selected={guidePlayId === play.id}
                  onclick={() => (guidePlayId = play.id)}>
                  <span class="play-name">{play.name}</span>
                  <span class="play-tag tag">{play.tag}</span>
                </button>
              {/each}
            </div>
          {/if}

          <button class="run-btn" disabled={!guideFormationId || !guidePlayId} onclick={runGuidePlay}>
            RUN PLAY
          </button>

        {:else if guideResult}
          <div class="guide-result" class:good={guideResult.decision_score >= 70} class:bad={guideResult.decision_score < 50}>
            <div class="gr-row">
              <span class="gr-yards">
                {#if guideResult.turnover}TURNOVER
                {:else}{guideResult.yards > 0 ? '+' : ''}{guideResult.yards} yds{/if}
              </span>
              <span class="gr-score-badge {guideScoreClass}">{guideScoreLabel}</span>
            </div>
            <p class="gr-breakdown">{guideResult.breakdown}</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Navigation -->
  <div class="tut-nav">
    <button class="nav-back" onclick={back} disabled={currentStep === 0}>← Back</button>
    <span class="step-counter">{currentStep + 1} / {STEPS.length}</span>
    {#if isLast}
      <button class="nav-next primary" onclick={finish}>Enter Coach Mode →</button>
    {:else}
      <button class="nav-next" onclick={next} disabled={!canAdvance}>
        {canAdvance ? 'Next →' : 'Run the play to continue'}
      </button>
    {/if}
  </div>
</div>

<style>
  .tut-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 0 1.5rem;
    font-size: 22px;
  }

  /* ── Header ──────────────────────────────────────────────── */
  .tut-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5em 0 0.4em;
    flex-shrink: 0;
  }

  .prog-bar {
    display: flex;
    gap: 0.35em;
    align-items: center;
  }

  .prog-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border);
    transition: background 0.2s;
  }

  .prog-dot.done    { background: var(--accent-muted); }
  .prog-dot.active  { background: var(--accent); width: 10px; height: 10px; }

  .skip-link {
    background: none;
    border: none;
    font-size: 0.65em;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    text-decoration: underline;
    padding: 0;
  }

  .skip-link:hover { color: var(--text-secondary); }

  /* ── Body ────────────────────────────────────────────────── */
  .tut-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 0.3em 0;
  }

  .tut-body.two-col {
    flex-direction: row;
    gap: 1.2em;
    align-items: flex-start;
  }

  .col-left {
    width: 13em;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4em;
  }

  .col-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.45em;
    min-width: 0;
  }

  .col-label {
    font-size: 0.58em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  /* ── Text step ───────────────────────────────────────────── */
  .text-step {
    max-width: 640px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.55em;
  }

  .step-title {
    font-size: 1.1em;
    font-weight: 800;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.2;
  }

  .step-title.sm { font-size: 0.9em; }

  .step-para {
    font-size: 0.78em;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  .step-para.sm { font-size: 0.72em; }

  .cta-btn {
    background: var(--accent);
    border: none;
    border-radius: 8px;
    padding: 0.55em 1.2em;
    font-size: 0.82em;
    font-weight: 800;
    letter-spacing: 0.06em;
    font-family: inherit;
    color: #fff;
    cursor: pointer;
    align-self: flex-start;
    margin-top: 0.4em;
    box-shadow: 0 4px 14px rgba(13,35,71,0.4);
    transition: box-shadow 0.15s, transform 0.05s;
  }

  .cta-btn:hover { box-shadow: 0 6px 18px rgba(13,35,71,0.5); transform: translateY(-1px); }

  /* ── Field diagram ───────────────────────────────────────── */
  .field-diagram {
    max-width: 300px;
    margin: 0 auto;
    width: 100%;
  }

  .diag-svg {
    width: 100%;
    height: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
    display: block;
    box-shadow: var(--neu-raised-sm);
  }

  /* ── Formation step ──────────────────────────────────────── */
  .callout-box {
    font-size: 0.65em;
    color: var(--text-muted);
    font-style: italic;
    padding: 0.4em 0.6em;
    background: var(--bg);
    border-radius: 5px;
    box-shadow: var(--neu-inset-sm);
  }

  .tells-preview {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    padding: 0.5em 0.7em;
    background: var(--bg);
    border-radius: 6px;
    box-shadow: var(--neu-inset-sm);
  }

  .tells-hdr {
    font-size: 0.56em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-bottom: 0.15em;
  }

  .tell-item {
    font-size: 0.68em;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  /* ── Situation step ──────────────────────────────────────── */
  .sit-step { max-width: 680px; }

  .sit-examples {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.35em;
    margin-top: 0.2em;
  }

  .sit-card {
    background: var(--bg);
    border-radius: 6px;
    padding: 0.45em 0.7em;
    box-shadow: var(--neu-raised-sm);
    display: flex;
    flex-direction: column;
    gap: 0.2em;
  }

  .sit-card-label {
    font-size: 0.82em;
    font-weight: 800;
    color: var(--accent);
    font-family: monospace;
  }

  .sit-card-note {
    font-size: 0.66em;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  /* ── Guided play step ────────────────────────────────────── */
  .opp-personnel {
    font-size: 0.62em;
    font-weight: 600;
    color: var(--text-muted);
  }

  .ai-reveal {
    display: flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.3em 0.5em;
    background: var(--bg);
    border-radius: 5px;
    box-shadow: var(--neu-raised-sm);
  }

  .ai-rev-lbl {
    font-size: 0.56em;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .ai-rev-name {
    font-size: 0.72em;
    font-weight: 600;
    color: var(--text-primary);
  }

  .hint-box {
    font-size: 0.7em;
    color: var(--text-secondary);
    line-height: 1.5;
    padding: 0.45em 0.7em;
    border-left: 2px solid var(--accent-muted);
    background: rgba(13,35,71,0.04);
    border-radius: 0 5px 5px 0;
  }

  .guide-call { overflow-y: auto; min-height: 0; }

  .picker-label {
    font-size: 0.58em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-top: 0.2em;
  }

  .formation-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.25em;
  }

  .formation-btn {
    background: var(--bg);
    border: none;
    border-radius: 5px;
    padding: 0.32em 0.5em;
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

  .fbn-name { font-size: 0.72em; font-weight: 700; color: var(--text-primary); }
  .fbn-pers { font-size: 0.58em; color: var(--text-muted); font-family: monospace; }

  .play-list { display: flex; flex-direction: column; gap: 0.18em; }

  .play-btn {
    background: var(--bg);
    border: none;
    border-radius: 5px;
    padding: 0.25em 0.55em;
    text-align: left;
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.15s;
    display: flex;
    align-items: center;
    gap: 0.4em;
  }

  .play-btn:hover { box-shadow: var(--neu-raised); }
  .play-btn.selected { box-shadow: var(--neu-inset-sm); outline: 2px solid var(--accent); outline-offset: -2px; }

  .play-name { font-size: 0.74em; font-weight: 700; color: var(--text-primary); }

  .tag {
    font-size: 0.54em;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 1px 4px;
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
    font-size: 0.74em;
    font-weight: 800;
    letter-spacing: 0.08em;
    font-family: inherit;
    color: #fff;
    cursor: pointer;
    margin-top: 0.3em;
    box-shadow: 0 4px 12px rgba(13,35,71,0.4);
    transition: box-shadow 0.15s, transform 0.05s;
    align-self: flex-start;
  }

  .run-btn:hover:not(:disabled) { box-shadow: 0 6px 16px rgba(13,35,71,0.5); transform: translateY(-1px); }
  .run-btn:disabled { opacity: 0.35; cursor: default; }

  .guide-result {
    background: var(--bg);
    border-radius: 7px;
    padding: 0.55em 0.8em;
    box-shadow: var(--neu-raised);
    display: flex;
    flex-direction: column;
    gap: 0.25em;
  }

  .guide-result.good { box-shadow: var(--neu-raised), inset 0 2px 0 rgba(26,122,60,0.4); }
  .guide-result.bad  { box-shadow: var(--neu-raised), inset 0 2px 0 rgba(176,40,32,0.35); }

  .gr-row { display: flex; align-items: center; gap: 0.7em; }

  .gr-yards { font-size: 0.95em; font-weight: 900; font-family: monospace; color: var(--off-accent); }

  .gr-score-badge {
    font-size: 0.62em;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .gr-score-badge.excellent { background: rgba(26,122,60,0.1);  color: #1a7a3c; border: 1px solid rgba(26,122,60,0.3); }
  .gr-score-badge.good      { background: rgba(26,122,60,0.06); color: #2d8a56; border: 1px solid rgba(26,122,60,0.2); }
  .gr-score-badge.poor      { background: rgba(176,40,32,0.1);  color: #b02820; border: 1px solid rgba(176,40,32,0.2); }

  .gr-breakdown {
    font-size: 0.68em;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  /* ── Navigation ──────────────────────────────────────────── */
  .tut-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5em 0 0.4em;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    gap: 0.5em;
  }

  .step-counter {
    font-size: 0.6em;
    font-weight: 600;
    color: var(--text-muted);
    font-family: monospace;
  }

  .nav-back, .nav-next {
    background: var(--bg);
    border: none;
    border-radius: 6px;
    padding: 0.35em 0.85em;
    font-size: 0.72em;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-primary);
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.15s;
    white-space: nowrap;
  }

  .nav-back:hover:not(:disabled), .nav-next:hover:not(:disabled) { box-shadow: var(--neu-raised); }
  .nav-back:disabled, .nav-next:disabled { opacity: 0.35; cursor: default; }

  .nav-next.primary {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 3px 10px rgba(13,35,71,0.35);
  }

  .nav-next.primary:hover { box-shadow: 0 5px 14px rgba(13,35,71,0.45); }
</style>
