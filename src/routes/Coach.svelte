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

  function openGlossary(term) {
    glossaryTerm.set(term);
    glossaryOpen.set(true);
  }

  // Initialize on mount
  initRound();

  $: downStr = ['', '1st', '2nd', '3rd', '4th'][situation.down] ?? `${situation.down}th`;
  $: fieldStr = situation.fieldPosition <= 50
    ? `OWN ${situation.fieldPosition}`
    : `OPP ${100 - situation.fieldPosition}`;
</script>

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

    <!-- Opponent panel -->
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
          <p class="opp-desc">{opponentFormation.description}</p>
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
              <div class="fbn-name">{f.name}</div>
              <div class="fbn-personnel">{f.personnel}</div>
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

  <!-- Outcome panel -->
  {#if phase === 'resolved' && result}
    <div class="outcome-panel" class:turnover={result.turnover} class:big-play={result.outcome_type === 'big_play' && !result.turnover}>
      <div class="outcome-top">
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
      </div>

      <p class="breakdown-text">{result.breakdown}</p>

      {#if bestCall}
        <div class="better-call">
          <span class="better-label">BETTER CALL:</span>
          <span class="better-name">{bestCall.name}</span>
          <span class="better-desc">— {bestCall.description}</span>
        </div>
      {/if}

      <button class="next-btn" onclick={initRound}>
        Next Play
      </button>
    </div>
  {/if}

</div>

<style>
  .coach-wrap {
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100%;
    overflow: hidden;
  }

  /* Situation strip */
  .situation-bar {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.6rem 0;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .sit-group {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }

  .sit-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .sit-value {
    font-size: 0.95rem;
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
    padding: 0.3rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  .side-btn:hover { background: var(--surface-raised); color: var(--text-primary); }
  .side-btn.active { background: var(--surface-raised); color: var(--text-primary); }

  /* Main layout */
  .coach-body {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 1.25rem;
    flex: 1;
    overflow: hidden;
    padding-top: 1rem;
    min-height: 0;
  }

  /* Opponent panel */
  .opponent-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    min-height: 0;
  }

  .panel-header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .panel-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .formation-name {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .field-wrap {
    flex-shrink: 0;
  }

  .opp-info {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .opp-personnel {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  .opp-desc {
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .ai-play-reveal {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.6rem;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: 4px;
    margin-top: 0.25rem;
  }

  .ai-play-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .ai-play-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  /* Call panel */
  .call-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    min-height: 0;
  }

  .picker-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .picker-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .formation-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
  }

  .formation-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.55rem 0.75rem;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.1s, background 0.1s;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .formation-btn:hover:not(:disabled) {
    border-color: var(--border-hover);
    background: var(--surface-raised);
  }

  .formation-btn.selected {
    border-color: var(--accent);
    background: var(--surface-raised);
  }

  .formation-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .fbn-name {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .fbn-personnel {
    font-size: 0.65rem;
    color: var(--text-muted);
    font-family: monospace;
  }

  /* Play list */
  .play-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .play-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.55rem 0.75rem;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.1s, background 0.1s;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .play-btn:hover:not(:disabled) {
    border-color: var(--border-hover);
    background: var(--surface-raised);
  }

  .play-btn.selected {
    border-color: var(--accent);
    background: var(--surface-raised);
  }

  .play-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .play-btn-top {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .play-name {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .play-desc {
    font-size: 0.74rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  /* Tag pill */
  .tag {
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 1px 5px;
    border-radius: 2px;
    border: 1px solid var(--border);
    color: var(--text-muted);
    background: var(--surface);
  }

  .picker-hint {
    font-size: 0.78rem;
    color: var(--text-muted);
    padding: 0.5rem 0;
  }

  /* Run Play button */
  .run-btn {
    background: var(--accent);
    border: none;
    border-radius: 4px;
    padding: 0.65rem 1.25rem;
    font-size: 0.85rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    font-family: inherit;
    color: #0b1117;
    cursor: pointer;
    transition: opacity 0.1s, transform 0.05s;
    margin-top: auto;
  }

  .run-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .run-btn:active:not(:disabled) { transform: translateY(0); }
  .run-btn:disabled { opacity: 0.35; cursor: default; }

  /* Outcome panel */
  .outcome-panel {
    border-top: 1px solid var(--border);
    padding: 1rem 0;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .outcome-panel.turnover {
    border-top-color: #8b2020;
  }

  .outcome-panel.big-play {
    border-top-color: var(--accent);
  }

  .outcome-top {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: wrap;
  }

  .outcome-yards {
    display: flex;
    align-items: baseline;
    gap: 0.3rem;
  }

  .yards-num {
    font-size: 2.2rem;
    font-weight: 900;
    font-family: monospace;
    line-height: 1;
    color: var(--off-accent);
  }

  .yards-num.neg { color: #c44; }
  .yards-num.pos { color: var(--off-accent); }

  .yards-unit {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .outcome-meta {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .outcome-label-badge {
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--text-primary);
  }

  .score-badge {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 2px 6px;
    border-radius: 3px;
    width: fit-content;
  }

  .score-badge.excellent { background: rgba(42,175,96,0.15); color: #2aaf60; border: 1px solid rgba(42,175,96,0.3); }
  .score-badge.good      { background: rgba(42,175,96,0.08); color: #5aaf80; border: 1px solid rgba(42,175,96,0.2); }
  .score-badge.neutral   { background: rgba(232,197,58,0.10); color: var(--accent); border: 1px solid rgba(232,197,58,0.2); }
  .score-badge.poor      { background: rgba(200,80,40,0.10); color: #c85030; border: 1px solid rgba(200,80,40,0.2); }

  .breakdown-text {
    font-size: 0.84rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
    max-width: 62ch;
  }

  .better-call {
    font-size: 0.78rem;
    color: var(--text-secondary);
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .better-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .better-name {
    font-weight: 700;
    color: var(--text-primary);
  }

  .better-desc {
    color: var(--text-muted);
  }

  .next-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.45rem 1rem;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-primary);
    cursor: pointer;
    width: fit-content;
    transition: border-color 0.1s, background 0.1s;
  }

  .next-btn:hover {
    border-color: var(--border-hover);
    background: var(--surface-raised);
  }
</style>
