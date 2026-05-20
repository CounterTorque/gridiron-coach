<script>
  import FormationField from '../lib/components/FormationField.svelte';
  import {
    getOffensePlays, getDefensePlays,
    getOffenseFormations, getDefenseFormations,
    generateSituation, pickAIFormation, pickAIPlay,
    resolve, getBestCall
  } from '../lib/matchup.js';
  import { glossaryOpen, glossaryTerm } from '../lib/stores/ui.js';

  // --- state ---
  let playerSide = 'offense';
  let phase = 'call'; // 'call' | 'resolved'

  let situation = generateSituation();
  let opponentFormation = null;
  let opponentPlayId = null;

  let selectedFormationId = null;
  let selectedPlayId = null;
  let result = null;

  // --- derived ---
  $: playerFormations = playerSide === 'offense' ? getOffenseFormations() : getDefenseFormations();
  $: selectedFormation = playerFormations.find(f => f.id === selectedFormationId) ?? null;
  $: playerPlays = selectedFormationId
    ? (playerSide === 'offense' ? getOffensePlays(selectedFormationId) : getDefensePlays(selectedFormationId))
    : [];

  $: needsToMove = result && !result.turnover && (result.yards >= situation.distance);
  $: outcomeLabel = result
    ? result.turnover
      ? 'TURNOVER'
      : result.outcome_type === 'stuff'
        ? 'STUFFED'
        : result.outcome_type === 'short'
          ? 'SHORT GAIN'
          : needsToMove
            ? 'FIRST DOWN'
            : result.outcome_type === 'big_play'
              ? 'BIG PLAY'
              : 'GAIN'
    : '';

  $: scoreLabel = result
    ? result.decision_score >= 80 ? 'EXCELLENT READ'
    : result.decision_score >= 60 ? 'GOOD CALL'
    : result.decision_score >= 40 ? 'NEUTRAL'
    : result.decision_score >= 20 ? 'POOR CALL'
    : 'BAD CALL'
    : '';

  $: scoreClass = result
    ? result.decision_score >= 80 ? 'excellent'
    : result.decision_score >= 60 ? 'good'
    : result.decision_score >= 40 ? 'neutral'
    : 'poor'
    : '';

  $: bestCall = result && result.decision_score < 60 && selectedFormationId
    ? getBestCall(
        playerSide === 'offense' ? selectedFormationId : opponentFormation?.id,
        playerSide === 'offense' ? opponentFormation?.id : selectedFormationId,
        opponentPlayId,
        playerSide
      )
    : null;

  // --- functions ---
  function initRound() {
    opponentFormation = pickAIFormation(playerSide === 'offense' ? 'defense' : 'offense');
    opponentPlayId = null;
    selectedFormationId = null;
    selectedPlayId = null;
    result = null;
    situation = generateSituation();
    phase = 'call';
  }

  function setSide(side) {
    if (side === playerSide) return;
    playerSide = side;
    initRound();
  }

  function selectFormation(id) {
    selectedFormationId = id;
    selectedPlayId = null;
  }

  function runPlay() {
    if (!selectedFormationId || !selectedPlayId || !opponentFormation) return;

    const aiPlay = pickAIPlay(opponentFormation.id, playerSide === 'offense' ? 'defense' : 'offense');
    opponentPlayId = aiPlay?.id ?? null;

    const offFormationId = playerSide === 'offense' ? selectedFormationId : opponentFormation.id;
    const offPlayId      = playerSide === 'offense' ? selectedPlayId      : opponentPlayId;
    const defFormationId = playerSide === 'defense' ? selectedFormationId : opponentFormation.id;
    const defPlayId      = playerSide === 'defense' ? selectedPlayId      : opponentPlayId;

    result = resolve({ offFormationId, offPlayId, defFormationId, defPlayId, playerSide, situation });
    phase = 'resolved';
  }

  // Initialize
  initRound();

  $: downStr = ['', '1st', '2nd', '3rd', '4th'][situation.down] ?? `${situation.down}th`;
  $: fieldStr = situation.fieldPosition <= 50
    ? `OWN ${situation.fieldPosition}`
    : `OPP ${100 - situation.fieldPosition}`;
</script>

<div class="coach-page">
<div class="coach-wrap">

  <!-- Situation strip -->
  <div class="situation-bar">
    <div class="sit-group">
      <span class="sit-label">DOWN</span>
      <span class="sit-value">{downStr} &amp; {situation.distance}</span>
    </div>
    <div class="sit-group">
      <span class="sit-label">FIELD POS</span>
      <span class="sit-value">{fieldStr}</span>
    </div>
    <div class="sit-spacer"></div>
    <div class="side-toggle">
      <button
        class="side-btn"
        class:active={playerSide === 'offense'}
        onclick={() => setSide('offense')}
      >Offense</button>
      <button
        class="side-btn"
        class:active={playerSide === 'defense'}
        onclick={() => setSide('defense')}
      >Defense</button>
    </div>
  </div>

  <!-- Main layout -->
  <div class="coach-body">

    <!-- Opponent panel — fixed narrow column so the field stays small -->
    <div class="opponent-panel">
      <div class="panel-header">
        <span class="panel-label">OPPONENT</span>
        {#if opponentFormation}
          <span class="formation-name">{opponentFormation.name}</span>
        {/if}
      </div>

      {#if opponentFormation}
        <div class="field-wrap">
          <FormationField formation={opponentFormation} compact={true} />
        </div>
        <div class="opp-info">
          <div class="opp-personnel">{opponentFormation.personnelLabel}</div>
          {#if phase === 'resolved' && opponentPlayId}
            {@const oppPlays = playerSide === 'offense'
              ? getDefensePlays(opponentFormation.id)
              : getOffensePlays(opponentFormation.id)}
            {@const oppPlay = oppPlays.find(p => p.id === opponentPlayId)}
            {#if oppPlay}
              <div class="ai-play-reveal">
                <span class="ai-play-label">THEY CALLED:</span>
                <span class="ai-play-name">{oppPlay.name}</span>
                <span class="ai-play-tag tag">{oppPlay.tag}</span>
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Player call panel -->
    <div class="call-panel">
      <div class="panel-header">
        <span class="panel-label">YOUR CALL</span>
      </div>

      <!-- Formation picker -->
      <div class="picker-section">
        <div class="picker-label">Formation</div>
        <div class="formation-grid">
          {#each playerFormations as f}
            <button
              class="formation-btn"
              class:selected={selectedFormationId === f.id}
              onclick={() => selectFormation(f.id)}
              disabled={phase === 'resolved'}
            >
              <span class="fbn-name">{f.name}</span>
              <span class="fbn-personnel">{f.personnel}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Play picker -->
      {#if playerPlays.length}
        <div class="picker-section">
          <div class="picker-label">Play</div>
          <div class="play-list">
            {#each playerPlays as play}
              <button
                class="play-btn"
                class:selected={selectedPlayId === play.id}
                onclick={() => (selectedPlayId = play.id)}
                disabled={phase === 'resolved'}
              >
                <div class="play-btn-top">
                  <span class="play-name">{play.name}</span>
                  <span class="play-tag tag">{play.tag}</span>
                </div>
                <div class="play-desc">{play.description}</div>
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <div class="picker-hint">Pick a formation to see plays</div>
      {/if}

      <!-- Run Play button -->
      {#if phase === 'call'}
        <button
          class="run-btn"
          disabled={!selectedFormationId || !selectedPlayId}
          onclick={runPlay}
        >
          RUN PLAY
        </button>
      {/if}
    </div>
  </div>

  <!-- Outcome panel — compact, fits without pushing layout off-screen -->
  {#if phase === 'resolved' && result}
    <div class="outcome-panel" class:turnover={result.turnover} class:big-play={result.outcome_type === 'big_play' && !result.turnover}>
      <div class="outcome-row">
        <div class="outcome-yards">
          {#if result.turnover}
            <span class="yards-num neg">TURNOVER</span>
          {:else}
            <span class="yards-num" class:neg={result.yards <= 0} class:pos={result.yards > 0}>
              {result.yards > 0 ? '+' : ''}{result.yards}
            </span>
            <span class="yards-unit">yds</span>
          {/if}
        </div>
        <div class="outcome-meta">
          <span class="outcome-label-badge">{outcomeLabel}</span>
          <span class="score-badge {scoreClass}">{scoreLabel} · {result.decision_score}/100</span>
        </div>
        <div class="outcome-spacer"></div>
        <button class="next-btn" onclick={initRound}>Next Play</button>
      </div>

      <p class="breakdown-text">{result.breakdown}</p>

      {#if bestCall}
        <div class="better-call">
          <span class="better-label">BETTER CALL:</span>
          <span class="better-name">{bestCall.name}</span>
          <span class="better-desc">— {bestCall.description}</span>
        </div>
      {/if}
    </div>
  {/if}

</div>
</div>

<style>
  /*
   * Outer shell: fills main-content, centers the scaled card.
   * No padding here — the em-based card handles its own sizing.
   */
  .coach-page {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
  }

  /*
   * The card.  font-size is driven by viewport height so every
   * em-based child dimension scales proportionally.
   *
   *   clamp(min, ideal, max)
   *   ideal = (dvh − topbar) / 32
   *   At 960 dvh: (960−56)/32 = 28.25 → capped at 28px  (~1.75× native)
   *   At 768 dvh: (768−56)/32 = 22.25px                  (~1.4× native)
   *   At 500 dvh: (500−56)/32 = 13.9 → floored at 13px
   *
   * max-width stays in px; width in % so it never bleeds on narrow viewports.
   */
  .coach-wrap {
    font-size: clamp(13px, calc((100dvh - 56px) / 32), 28px);
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 960px;
  }

  /* ── Situation strip ─────────────────────────────── */
  .situation-bar {
    display: flex;
    align-items: center;
    gap: 1.25em;
    padding: 0.35em 0;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .sit-group {
    display: flex;
    align-items: baseline;
    gap: 0.35em;
  }

  .sit-label {
    font-size: 0.6em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .sit-value {
    font-size: 0.85em;
    font-weight: 700;
    color: var(--accent);
    font-family: monospace;
  }

  .sit-spacer { flex: 1; }

  .side-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }

  .side-btn {
    background: none;
    border: none;
    padding: 0.25em 0.7em;
    font-size: 0.73em;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  .side-btn:hover { background: var(--surface-raised); color: var(--text-primary); }
  .side-btn.active { background: var(--surface-raised); color: var(--text-primary); }

  /* ── Main body ───────────────────────────────────── */
  .coach-body {
    display: grid;
    /* Left column in em so it scales with font-size (190px ÷ 16px = 11.875em) */
    grid-template-columns: 11.875em 1fr;
    gap: 1em;
    padding-top: 0.6em;
  }

  /* ── Opponent panel ──────────────────────────────── */
  .opponent-panel {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
  }

  .panel-header {
    display: flex;
    align-items: baseline;
    gap: 0.45em;
    flex-shrink: 0;
  }

  .panel-label {
    font-size: 0.6em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .formation-name {
    font-size: 0.84em;
    font-weight: 700;
    color: var(--text-primary);
  }

  .field-wrap { flex-shrink: 0; }

  .opp-info {
    display: flex;
    flex-direction: column;
    gap: 0.3em;
  }

  .opp-personnel {
    font-size: 0.67em;
    font-weight: 600;
    color: var(--text-muted);
    letter-spacing: 0.03em;
  }

  .ai-play-reveal {
    display: flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.32em 0.55em;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: 4px;
  }

  .ai-play-label {
    font-size: 0.58em;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .ai-play-name {
    font-size: 0.78em;
    font-weight: 600;
    color: var(--text-primary);
  }

  /* ── Call panel ──────────────────────────────────── */
  .call-panel {
    display: flex;
    flex-direction: column;
    gap: 0.55em;
  }

  .picker-section {
    display: flex;
    flex-direction: column;
    gap: 0.28em;
    flex-shrink: 0;
  }

  .picker-label {
    font-size: 0.6em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .formation-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.3em;
  }

  .formation-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.38em 0.6em;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.1s, background 0.1s;
    display: flex;
    align-items: baseline;
    gap: 0.4em;
  }

  .formation-btn:hover:not(:disabled) {
    border-color: var(--border-hover);
    background: var(--surface-raised);
  }

  .formation-btn.selected {
    border-color: var(--accent);
    background: var(--surface-raised);
  }

  .formation-btn:disabled { opacity: 0.5; cursor: default; }

  .fbn-name {
    font-size: 0.78em;
    font-weight: 700;
    color: var(--text-primary);
  }

  .fbn-personnel {
    font-size: 0.62em;
    color: var(--text-muted);
    font-family: monospace;
  }

  /* Play list */
  .play-list {
    display: flex;
    flex-direction: column;
    gap: 0.22em;
  }

  .play-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.32em 0.65em;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.1s, background 0.1s;
    display: flex;
    flex-direction: column;
    gap: 0.1em;
  }

  .play-btn:hover:not(:disabled) {
    border-color: var(--border-hover);
    background: var(--surface-raised);
  }

  .play-btn.selected {
    border-color: var(--accent);
    background: var(--surface-raised);
  }

  .play-btn:disabled { opacity: 0.5; cursor: default; }

  .play-btn-top {
    display: flex;
    align-items: center;
    gap: 0.35em;
  }

  .play-name {
    font-size: 0.8em;
    font-weight: 700;
    color: var(--text-primary);
  }

  .play-desc {
    font-size: 0.67em;
    color: var(--text-muted);
    line-height: 1.3;
  }

  /* Tag pill — px padding intentional (sub-pixel decorative border) */
  .tag {
    font-size: 0.56em;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 1px 4px;
    border-radius: 2px;
    border: 1px solid var(--border);
    color: var(--text-muted);
    background: var(--surface);
  }

  .picker-hint {
    font-size: 0.75em;
    color: var(--text-muted);
    padding: 0.3em 0;
  }

  /* Run Play button */
  .run-btn {
    background: var(--accent);
    border: none;
    border-radius: 4px;
    padding: 0.5em 1em;
    font-size: 0.8em;
    font-weight: 800;
    letter-spacing: 0.08em;
    font-family: inherit;
    color: #0b1117;
    cursor: pointer;
    transition: opacity 0.1s, transform 0.05s;
    margin-top: 0.25em;
  }

  .run-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .run-btn:active:not(:disabled) { transform: translateY(0); }
  .run-btn:disabled { opacity: 0.35; cursor: default; }

  /* ── Outcome panel ───────────────────────────────── */
  .outcome-panel {
    border-top: 1px solid var(--border);
    padding: 0.5em 0;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3em;
  }

  .outcome-panel.turnover  { border-top-color: #8b2020; }
  .outcome-panel.big-play  { border-top-color: var(--accent); }

  /* Single row: yards | labels | spacer | Next Play */
  .outcome-row {
    display: flex;
    align-items: center;
    gap: 0.9em;
  }

  .outcome-yards {
    display: flex;
    align-items: baseline;
    gap: 0.25em;
    flex-shrink: 0;
  }

  .yards-num {
    font-size: 1.6em;
    font-weight: 900;
    font-family: monospace;
    line-height: 1;
    color: var(--off-accent);
  }

  .yards-num.neg { color: #c44; }
  .yards-num.pos { color: var(--off-accent); }

  .yards-unit {
    font-size: 0.78em;
    font-weight: 600;
    color: var(--text-muted);
  }

  .outcome-meta {
    display: flex;
    align-items: center;
    gap: 0.5em;
    flex-wrap: wrap;
  }

  .outcome-label-badge {
    font-size: 0.7em;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--text-primary);
  }

  /* px padding intentional — sub-pixel decorative */
  .score-badge {
    font-size: 0.65em;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .score-badge.excellent { background: rgba(42,175,96,0.15);  color: #2aaf60; border: 1px solid rgba(42,175,96,0.3); }
  .score-badge.good      { background: rgba(42,175,96,0.08);  color: #5aaf80; border: 1px solid rgba(42,175,96,0.2); }
  .score-badge.neutral   { background: rgba(232,197,58,0.10); color: var(--accent); border: 1px solid rgba(232,197,58,0.2); }
  .score-badge.poor      { background: rgba(200,80,40,0.10);  color: #c85030; border: 1px solid rgba(200,80,40,0.2); }

  .outcome-spacer { flex: 1; }

  .breakdown-text {
    font-size: 0.78em;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
    /* clamp to 2 lines so it never blows up the panel */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .better-call {
    font-size: 0.72em;
    color: var(--text-secondary);
    display: flex;
    align-items: baseline;
    gap: 0.3em;
    flex-wrap: wrap;
  }

  .better-label {
    font-size: 0.6em;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .better-name { font-weight: 700; color: var(--text-primary); }
  .better-desc { color: var(--text-muted); }

  .next-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.35em 0.85em;
    font-size: 0.75em;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-primary);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: border-color 0.1s, background 0.1s;
  }

  .next-btn:hover {
    border-color: var(--border-hover);
    background: var(--surface-raised);
  }
</style>
