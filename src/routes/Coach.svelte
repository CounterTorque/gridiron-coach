<script>
  import { tick } from 'svelte';
  import FormationField from '../lib/components/FormationField.svelte';
  import Playout from '../lib/components/Playout.svelte';
  import BreakdownText from '../lib/components/BreakdownText.svelte';
  import { recordPlay, getOverallAvg } from '../lib/progression.js';
  import {
    getOffensePlays, getDefensePlays,
    getOffenseFormations, getDefenseFormations,
    pickAIFormation, pickAIPlay,
    resolve, getBestCall,
    getFormationById, getPlayById
  } from '../lib/matchup.js';

  // ── Personnel packages ─────────────────────────────────────────
  const OFFENSE_PACKAGES = [
    { id: '11', abbr: '11', name: '11 Personnel', desc: '1 RB · 1 TE · 3 WR', hint: 'Three wide receivers stress any coverage — built for passing situations.', formations: ['shotgun_trips', 'singleback'] },
    { id: '21', abbr: '21', name: '21 Personnel', desc: '2 RB · 1 TE · 2 WR', hint: 'Fullback adds a lead blocker — balanced run and play-action threat.', formations: ['i_formation', 'singleback'] },
    { id: '22', abbr: '22', name: '22 Personnel', desc: '2 RB · 2 TE · 1 WR', hint: 'Maximum blockers at the point of attack — goal line and short yardage specialist.', formations: ['goal_line_off'] },
  ];
  const DEFENSE_PACKAGES = [
    { id: 'base', abbr: '4-3', name: 'Base 4-3', desc: '4 DL · 3 LB · 4 DB', hint: 'Balanced against run and pass — the standard starting point for most situations.', formations: ['four_three', 'stacked_box'] },
    { id: 'nickel', abbr: 'NKL', name: 'Nickel Sub', desc: '4 DL · 2 LB · 5 DB', hint: 'Fifth DB replaces a linebacker — counters 3-WR spread formations.', formations: ['nickel'] },
    { id: 'heavy', abbr: 'GL', name: 'Goal Line', desc: '5 DL · 3 LB · 3 DB', hint: 'Maximum run-stoppers — deploy when the offense needs inches.', formations: ['goal_line_def'] },
  ];

  // ── Drive state ────────────────────────────────────────────────
  let fieldPosition = 20; // 0=own goal, 100=opponent end zone
  let down = 1;
  let distance = 10;
  let offenseScore = 0;
  let defenseScore = 0;
  let driveXP = 0;
  let driveNumber = 1;
  // 'active' | 'first_down' | 'touchdown' | 'turnover' | 'turnover_on_downs' | 'field_goal' | 'field_goal_miss' | 'punt'
  let driveStatus = 'active';
  let lastPlayXP = 0;
  let totalXP = 0;

  // ── Game clock ─────────────────────────────────────────────────
  let quarter = 1;
  let gameClock = 900; // 15:00 in Q1
  let pendingGameOver = false;
  let gameOver = false;

  // ── Phase 5 state ──────────────────────────────────────────────
  let selectedPersonnel = null;
  let opponentPrePickedPlayId = null;
  let motionUsed = false;
  let motionReveal = null; // null | 'man' | 'zone' | 'run_heavy' | 'pass_heavy'
  let audibleUsed = false;

  // ── Round state ────────────────────────────────────────────────
  let playerSide = 'offense';
  // 'call' | 'fourth_down' | 'playout' | 'resolved' | 'drive_over'
  let phase = 'call';

  let opponentFormation = null;
  let opponentPlayId = null;
  let selectedFormationId = null;
  let selectedPlayId = null;
  let result = null;

  let outcomeEl = null;

  // Held between runPlay → onPlayoutDone
  let pendingOff = null; // { formationId, playId }
  let pendingDef = null;
  // Snap-shot of situation at time of call (before drive update)
  let calledDistance = 10;

  // ── Derived ────────────────────────────────────────────────────
  $: situation = { down, distance, fieldPosition };
  $: playerFormations = playerSide === 'offense' ? getOffenseFormations() : getDefenseFormations();
  $: selectedFormation = playerFormations.find(f => f.id === selectedFormationId) ?? null;
  $: playerPlays = selectedFormationId
    ? (playerSide === 'offense' ? getOffensePlays(selectedFormationId) : getDefensePlays(selectedFormationId))
    : [];

  $: inFGRange = (100 - fieldPosition) <= 48; // kick from ~65 yards max
  $: yardsToGo = 100 - fieldPosition;

  $: outcomeLabel = result
    ? result.turnover ? 'TURNOVER'
    : result.outcome_type === 'stuff'    ? 'STUFFED'
    : result.outcome_type === 'short'    ? 'SHORT GAIN'
    : result.yards >= calledDistance     ? 'FIRST DOWN'
    : result.outcome_type === 'big_play' ? 'BIG PLAY'
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
        opponentPlayId, playerSide
      )
    : null;

  $: downStr = ['','1st','2nd','3rd','4th'][down] ?? `${down}th`;
  $: fieldStr = fieldPosition <= 50 ? `OWN ${fieldPosition}` : `OPP ${100 - fieldPosition}`;

  // ── Phase 5 derived ────────────────────────────────────────────
  $: packages = playerSide === 'offense' ? OFFENSE_PACKAGES : DEFENSE_PACKAGES;
  $: currentPackage = packages.find(p => p.id === selectedPersonnel) ?? null;
  $: filteredFormations = currentPackage
    ? playerFormations.filter(f => currentPackage.formations.includes(f.id))
    : playerFormations;
  $: clockDisplay = `${Math.floor(gameClock / 60)}:${String(gameClock % 60).padStart(2, '0')}`;
  $: isLateGame = quarter === 4 && gameClock < 300;
  $: twoMinWarning = quarter === 4 && gameClock <= 120;
  $: trailingLate = isLateGame && playerScore < oppScore;
  $: leadingLate = isLateGame && playerScore > oppScore;
  $: urgencyLabel = trailingLate ? 'HURRY-UP' : leadingLate ? 'PROTECT LEAD' : twoMinWarning ? '2-MIN WARNING' : null;

  let masteryAvg = getOverallAvg();

  // Playout props (resolved after animation to avoid flicker)
  $: playoutOffFormation = pendingOff ? getFormationById(pendingOff.formationId) : null;
  $: playoutDefFormation = pendingDef ? getFormationById(pendingDef.formationId) : null;
  $: playoutOffPlay = pendingOff ? getPlayById('offense', pendingOff.formationId, pendingOff.playId) : null;

  // Score bar labels
  $: offLabel = playerSide === 'offense' ? 'YOU' : 'OPP';
  $: defLabel = playerSide === 'defense' ? 'YOU' : 'OPP';
  $: playerScore = playerSide === 'offense' ? offenseScore : defenseScore;
  $: oppScore    = playerSide === 'offense' ? defenseScore : offenseScore;

  // Drive over display
  $: driveOverTitle =
    driveStatus === 'touchdown'        ? 'TOUCHDOWN!'
    : driveStatus === 'field_goal'     ? 'FIELD GOAL'
    : driveStatus === 'field_goal_miss'? 'FIELD GOAL MISSED'
    : driveStatus === 'turnover'       ? 'TURNOVER'
    : driveStatus === 'turnover_on_downs' ? 'TURNOVER ON DOWNS'
    : driveStatus === 'punt'           ? 'PUNT'
    : driveStatus === 'time_expired'   ? 'TIME EXPIRED'
    : '';

  $: driveOverClass =
    driveStatus === 'touchdown' || driveStatus === 'field_goal' ? 'score'
    : driveStatus === 'turnover' || driveStatus === 'turnover_on_downs' ? 'bad'
    : 'neutral';

  // ── Helpers ────────────────────────────────────────────────────
  function calcXP(score) {
    if (score >= 80) return 25;
    if (score >= 60) return 15;
    if (score >= 40) return 5;
    return 0;
  }

  function applyDriveUpdate(playResult) {
    if (playResult.turnover) {
      driveStatus = 'turnover';
      return 'drive_over';
    }

    const newFP = fieldPosition + playResult.yards;

    if (newFP >= 100) {
      offenseScore += 7; // offense always scores TDs
      driveStatus = 'touchdown';
      fieldPosition = 100;
      return 'drive_over';
    }

    fieldPosition = Math.max(1, newFP);

    if (playResult.yards >= calledDistance) {
      down = 1;
      distance = Math.min(10, Math.max(1, 100 - fieldPosition));
      driveStatus = 'first_down';
      return 'continue';
    }

    if (down < 4) {
      down++;
      distance = Math.max(1, distance - Math.max(0, playResult.yards));
      driveStatus = 'active';
      return 'continue';
    }

    // Was on 4th down going for it — failed
    driveStatus = 'turnover_on_downs';
    return 'drive_over';
  }

  // ── Init ───────────────────────────────────────────────────────
  function initPlay() {
    opponentFormation = pickAIFormation(playerSide === 'offense' ? 'defense' : 'offense');
    opponentPlayId = null;
    selectedFormationId = null;
    selectedPlayId = null;
    result = null;
    lastPlayXP = 0;
    pendingOff = null;
    pendingDef = null;

    // Phase 5: reset per-play state
    selectedPersonnel = null;
    motionUsed = false;
    motionReveal = null;
    audibleUsed = false;
    opponentPrePickedPlayId = null;

    // Pre-pick AI play so motion can reveal coverage type
    if (opponentFormation) {
      const side = playerSide === 'offense' ? 'defense' : 'offense';
      const aiPlay = pickAIPlay(opponentFormation.id, side);
      opponentPrePickedPlayId = aiPlay?.id ?? null;
    }

    if (down === 4 && playerSide === 'defense') {
      // AI (opponent offense) decides automatically — defense player doesn't call 4th down
      aiHandleFourthDown();
    } else {
      phase = down === 4 ? 'fourth_down' : 'call';
    }
  }

  function aiHandleFourthDown() {
    const yd = 100 - fieldPosition; // yards to end zone
    const kickDist = yd + 17;
    const inRange = yd <= 48;
    if (inRange && Math.random() < 0.55) {
      // AI tries field goal
      chooseFieldGoal();
    } else if (distance <= 2 && fieldPosition >= 50 && Math.random() < 0.6) {
      // Short yardage in opponent territory — go for it
      phase = 'call';
    } else {
      // Punt
      choosePunt();
    }
  }

  function initDrive(startFP = 20, side = playerSide) {
    playerSide = side;
    fieldPosition = startFP;
    down = 1;
    distance = 10;
    driveXP = 0;
    driveNumber++;
    initPlay();
  }

  function setSide(side) {
    if (side === playerSide) return;
    offenseScore = 0;
    defenseScore = 0;
    driveNumber = 0; // initDrive will increment to 1
    initDrive(20, side);
  }

  // ── Actions ────────────────────────────────────────────────────
  function selectFormation(id) {
    selectedFormationId = id;
    selectedPlayId = null;
  }

  function runPlay() {
    if (!selectedFormationId || !selectedPlayId || !opponentFormation) return;
    calledDistance = distance;

    const aiPlay = opponentPrePickedPlayId
      ? { id: opponentPrePickedPlayId }
      : pickAIPlay(opponentFormation.id, playerSide === 'offense' ? 'defense' : 'offense');
    opponentPlayId = aiPlay?.id ?? null;

    const offFormationId = playerSide === 'offense' ? selectedFormationId : opponentFormation.id;
    const offPlayId      = playerSide === 'offense' ? selectedPlayId      : opponentPlayId;
    const defFormationId = playerSide === 'defense' ? selectedFormationId : opponentFormation.id;
    const defPlayId      = playerSide === 'defense' ? selectedPlayId      : opponentPlayId;

    pendingOff = { formationId: offFormationId, playId: offPlayId };
    pendingDef = { formationId: defFormationId, playId: defPlayId };
    phase = 'playout';
  }

  async function onPlayoutDone() {
    if (!pendingOff || !pendingDef) return;
    result = resolve({
      offFormationId: pendingOff.formationId,
      offPlayId: pendingOff.playId,
      defFormationId: pendingDef.formationId,
      defPlayId: pendingDef.playId,
      playerSide,
      situation
    });
    lastPlayXP = calcXP(result.decision_score);
    driveXP += lastPlayXP;
    totalXP += lastPlayXP;
    recordPlay(situation, result.decision_score);
    masteryAvg = getOverallAvg();
    // Advance game clock ~30-45 seconds per play
    advanceClock(30 + Math.floor(Math.random() * 15));
    phase = 'resolved';
    await tick();
    outcomeEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function advanceFromResolved() {
    if (!result) return;
    const next = applyDriveUpdate(result);
    if (next === 'drive_over') {
      phase = 'drive_over';
    } else if (pendingGameOver) {
      // Clock expired mid-drive — end the drive
      driveStatus = 'time_expired';
      phase = 'drive_over';
    } else if (down === 4) {
      // Next play is 4th down — show choice
      result = null;
      opponentFormation = pickAIFormation(playerSide === 'offense' ? 'defense' : 'offense');
      selectedFormationId = null;
      selectedPlayId = null;
      phase = 'fourth_down';
    } else {
      initPlay();
    }
  }

  // 4th down choices
  function choosePunt() {
    const puntYards = 38 + Math.floor(Math.random() * 10);
    const kickLands = fieldPosition + puntYards;
    const newFP = kickLands >= 95 ? 20 : Math.max(15, 100 - kickLands);
    driveStatus = 'punt';
    phase = 'drive_over';
    // store newFP so startNewDrive can use it
    _pendingNewFP = newFP;
  }

  let _pendingNewFP = null;

  function chooseFieldGoal() {
    const kickYards = yardsToGo + 17;
    const prob = Math.max(0.15, 1 - (kickYards - 20) * 0.014);
    if (Math.random() < prob) {
      offenseScore += 3; // offense always kicks FGs
      driveStatus = 'field_goal';
    } else {
      driveStatus = 'field_goal_miss';
    }
    phase = 'drive_over';
  }

  function chooseGoForIt() {
    phase = 'call';
    opponentFormation = pickAIFormation(playerSide === 'offense' ? 'defense' : 'offense');
    selectedFormationId = null;
    selectedPlayId = null;
  }

  function startNewDrive() {
    // Consume kickoff/transition time (~2 minutes)
    advanceClock(90 + Math.floor(Math.random() * 60));
    if (pendingGameOver) {
      gameOver = true;
      return;
    }

    let newSide = playerSide === 'offense' ? 'defense' : 'offense';
    let startFP;

    switch (driveStatus) {
      case 'touchdown':
      case 'field_goal':
        startFP = 25;
        break;
      case 'punt': {
        startFP = _pendingNewFP ?? 20;
        _pendingNewFP = null;
        break;
      }
      case 'turnover':
        startFP = Math.max(1, Math.min(80, 100 - fieldPosition));
        break;
      case 'turnover_on_downs':
      case 'field_goal_miss':
        startFP = Math.max(1, 100 - fieldPosition);
        break;
      default:
        startFP = 20;
    }

    initDrive(startFP, newSide);
  }

  // ── Phase 5 functions ──────────────────────────────────────────
  function advanceClock(seconds) {
    gameClock -= seconds;
    if (gameClock <= 0) {
      if (quarter < 4) {
        quarter++;
        gameClock = 900;
      } else {
        gameClock = 0;
        pendingGameOver = true;
      }
    }
  }

  function handleMotion() {
    if (motionUsed || !opponentFormation) return;
    motionUsed = true;
    const side = playerSide === 'offense' ? 'defense' : 'offense';
    const opponentPlays = side === 'defense'
      ? getDefensePlays(opponentFormation.id)
      : getOffensePlays(opponentFormation.id);
    const prePick = opponentPlays.find(p => p.id === opponentPrePickedPlayId);
    if (!prePick) { motionReveal = playerSide === 'offense' ? 'zone' : 'run_heavy'; return; }
    if (playerSide === 'offense') {
      motionReveal = (prePick.type === 'man' || prePick.type === 'pressure') ? 'man' : 'zone';
    } else {
      motionReveal = (prePick.type === 'run' || prePick.type === 'option') ? 'run_heavy' : 'pass_heavy';
    }
  }

  function handleAudible() {
    if (audibleUsed) return;
    audibleUsed = true;
    selectedPlayId = null;
  }

  function resetGame() {
    quarter = 1;
    gameClock = 900;
    pendingGameOver = false;
    gameOver = false;
    totalXP = 0;
    offenseScore = 0;
    defenseScore = 0;
    driveNumber = 0;
    initDrive(20, playerSide);
  }

  // Initial setup
  initPlay();
</script>

<div class="coach-wrap">

  <!-- Score bar -->
  <div class="score-bar">
    <div class="score-group">
      <span class="score-side-label">{offLabel}</span>
      <span class="score-num off">{offenseScore}</span>
    </div>
    <span class="score-sep">—</span>
    <div class="score-group">
      <span class="score-num def">{defenseScore}</span>
      <span class="score-side-label">{defLabel}</span>
    </div>
    <div class="score-spacer"></div>
    <div class="drive-info">
      <span class="drive-label">DRIVE {driveNumber}</span>
      {#if driveXP > 0}
        <span class="xp-badge">+{driveXP} XP</span>
      {/if}
      {#if masteryAvg !== null}
        <span class="mastery-chip" title="Rolling decision score average (last 10 plays)">AVG {masteryAvg}</span>
      {/if}
    </div>
    <div class="side-toggle">
      <button class="side-btn" class:active={playerSide === 'offense'} onclick={() => setSide('offense')}>Offense</button>
      <button class="side-btn" class:active={playerSide === 'defense'} onclick={() => setSide('defense')}>Defense</button>
    </div>
  </div>

  <!-- Situation strip -->
  <div class="situation-bar">
    <div class="sit-group">
      <span class="sit-label">DOWN</span>
      <span class="sit-value">{downStr} &amp; {distance}</span>
    </div>
    <div class="sit-group">
      <span class="sit-label">FIELD POS</span>
      <span class="sit-value">{fieldStr}</span>
    </div>
    <div class="sit-group">
      <span class="sit-label">Q{quarter}</span>
      <span class="sit-value" class:clock-urgent={twoMinWarning}>{clockDisplay}</span>
    </div>
  </div>

  <!-- Late-game urgency strip -->
  {#if urgencyLabel && phase !== 'drive_over' && !gameOver}
    <div class="urgency-strip" class:hurry={trailingLate} class:protect={leadingLate} class:warning={twoMinWarning && !trailingLate && !leadingLate}>
      {urgencyLabel}
      {#if trailingLate}— need a score, consider aggressive play calls{/if}
      {#if leadingLate}— protect the football, run the clock{/if}
      {#if twoMinWarning && !trailingLate && !leadingLate}— clock is a factor now{/if}
    </div>
  {/if}

  <!-- ── GAME OVER ────────────────────────────────────────────── -->
  {#if gameOver}
    <div class="game-over-panel">
      <div class="game-over-quarter">FINAL</div>
      <div class="game-over-score">
        <span class="go-side off">{offLabel}</span>
        <span class="go-num off">{offenseScore}</span>
        <span class="go-dash">–</span>
        <span class="go-num def">{defenseScore}</span>
        <span class="go-side def">{defLabel}</span>
      </div>
      <div class="go-xp">Total XP earned: <strong>{totalXP}</strong></div>
      <div class="go-buttons">
        <button class="new-drive-btn" onclick={resetGame}>New Game →</button>
      </div>
    </div>

  <!-- ── PLAYOUT phase ─────────────────────────────────────── -->
  {:else if phase === 'playout'}
    <div class="playout-section">
      <Playout
        offFormation={playoutOffFormation}
        defFormation={playoutDefFormation}
        offPlay={playoutOffPlay}
        {result}
        onDone={onPlayoutDone}
      />
    </div>

  <!-- ── DRIVE OVER phase ──────────────────────────────────── -->
  {:else if phase === 'drive_over'}
    <div class="drive-over-panel {driveOverClass}">
      <div class="drive-over-title">{driveOverTitle}</div>
      <div class="drive-over-scores">
        <span class="dos-label">SCORE</span>
        <span class="dos-val">{offLabel} <strong>{offenseScore}</strong> – <strong>{defenseScore}</strong> {defLabel}</span>
      </div>
      <div class="drive-over-xp">
        <span class="dos-label">DRIVE XP</span>
        <span class="dos-xp">+{driveXP}</span>
      </div>
      <button class="new-drive-btn" onclick={startNewDrive}>New Drive →</button>
    </div>

  <!-- ── CALL / FOURTH DOWN / RESOLVED phases ─────────────── -->
  {:else}
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
            <FormationField formation={opponentFormation} compact={true} showTells={true} />
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

      <!-- Right panel: 4th-down choice | call | resolved -->
      <div class="call-panel">

        {#if phase === 'fourth_down'}
          <!-- 4th down decision -->
          <div class="panel-header">
            <span class="panel-label">4TH DOWN DECISION</span>
          </div>
          <p class="fourth-sub">{downStr} &amp; {distance} — {fieldStr}</p>
          <div class="fourth-options">
            <button class="fourth-btn punt" onclick={choosePunt}>
              <span class="fb-name">Punt</span>
              <span class="fb-desc">Flip field position. ~40 yards.</span>
            </button>
            {#if inFGRange}
              <button class="fourth-btn fg" onclick={chooseFieldGoal}>
                <span class="fb-name">Field Goal</span>
                <span class="fb-desc">{yardsToGo + 17} yd attempt · 3 pts if good</span>
              </button>
            {/if}
            <button class="fourth-btn go" onclick={chooseGoForIt}>
              <span class="fb-name">Go For It</span>
              <span class="fb-desc">Call a play. Convert or turn it over.</span>
            </button>
          </div>

        {:else}
          <!-- Formation + play picker -->
          <div class="panel-header">
            <span class="panel-label">YOUR CALL</span>
          </div>

          <!-- Personnel package picker -->
          {#if phase === 'call' && !selectedPersonnel}
            <div class="picker-section">
              <div class="picker-label">Personnel Package</div>
              <div class="personnel-list">
                {#each packages as pkg}
                  <button class="personnel-btn" onclick={() => { selectedPersonnel = pkg.id; }}>
                    <span class="pkg-abbr">{pkg.abbr}</span>
                    <div class="pkg-info">
                      <span class="pkg-name">{pkg.name}</span>
                      <span class="pkg-desc">{pkg.desc}</span>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {:else if selectedPersonnel && currentPackage}
            <div class="pkg-selected-row">
              <span class="pkg-badge">{currentPackage.abbr}</span>
              <div class="pkg-sel-info">
                <span class="pkg-sel-name">{currentPackage.name}</span>
                <span class="pkg-sel-hint">{currentPackage.hint}</span>
              </div>
              {#if phase === 'call'}
                <button class="pkg-change-btn" onclick={() => { selectedPersonnel = null; selectedFormationId = null; selectedPlayId = null; }}>↺</button>
              {/if}
            </div>
          {/if}

          {#if selectedPersonnel || phase === 'resolved'}
            <div class="picker-section">
              <div class="picker-label">Formation</div>
              <div class="formation-grid">
                {#each filteredFormations as f}
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
            {:else if phase === 'call' && selectedFormationId}
              <div class="picker-hint">Pick a formation to see plays</div>
            {/if}

            {#if phase === 'call'}
              <!-- Motion reveal -->
              {#if selectedFormationId && !motionUsed}
                <button class="motion-btn" onclick={handleMotion}>
                  Pre-snap Motion →
                </button>
              {/if}

              {#if motionReveal}
                <div class="motion-reveal">
                  {#if motionReveal === 'man'}
                    Corner followed the motion — <strong>Man coverage</strong> suspected. Attack with crossing routes or screens.
                  {:else if motionReveal === 'zone'}
                    No pursuit on the motion — <strong>Zone coverage</strong> suspected. Attack the soft spots and seams.
                  {:else if motionReveal === 'run_heavy'}
                    Extra blockers shifting — <strong>Run tendency</strong> spotted. Consider a run-stop call.
                  {:else if motionReveal === 'pass_heavy'}
                    Receivers spreading wide — <strong>Pass tendency</strong> spotted. Consider zone or man coverage.
                  {/if}
                </div>
              {/if}

              <!-- Audible -->
              {#if selectedPlayId && !audibleUsed}
                <button class="audible-btn" onclick={handleAudible}>
                  Audible — Change Play
                </button>
              {/if}
              {#if audibleUsed && !selectedPlayId}
                <div class="audible-notice">Audible called — pick a new play</div>
              {/if}

              <button class="run-btn" disabled={!selectedFormationId || !selectedPlayId} onclick={runPlay}>
                RUN PLAY
              </button>
            {/if}
          {/if}
        {/if}
      </div>
    </div>

    <!-- Outcome panel -->
    {#if phase === 'resolved' && result}
      <div class="outcome-panel" bind:this={outcomeEl}
        class:turnover={result.turnover}
        class:big-play={result.outcome_type === 'big_play' && !result.turnover}
      >
        <div class="outcome-row">
          <div class="outcome-yards">
            {#if result.turnover}
              <span class="yards-num neg">TO</span>
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
            {#if lastPlayXP > 0}
              <span class="xp-earned">+{lastPlayXP} XP</span>
            {/if}
          </div>
          <div class="outcome-spacer"></div>
          <button class="next-btn" onclick={advanceFromResolved}>Next →</button>
        </div>

        <p class="breakdown-text"><BreakdownText text={result.breakdown} /></p>

        {#if bestCall}
          <div class="better-call">
            <span class="better-label">BETTER CALL:</span>
            <span class="better-name">{bestCall.name}</span>
            <span class="better-desc">— {bestCall.description}</span>
          </div>
        {/if}
      </div>
    {/if}
  {/if}

</div>

<style>
  .coach-wrap {
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

  /* ── Score bar ─────────────────────────────────────────────── */
  .score-bar {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.3em 0;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .score-group {
    display: flex;
    align-items: baseline;
    gap: 0.3em;
  }

  .score-side-label {
    font-size: 0.54em;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .score-num {
    font-size: 1em;
    font-weight: 900;
    font-family: monospace;
    line-height: 1;
  }

  .score-num.off { color: var(--off-accent); }
  .score-num.def { color: var(--accent); }

  .score-sep {
    font-size: 0.7em;
    color: var(--text-muted);
  }

  .score-spacer { flex: 1; }

  .drive-info {
    display: flex;
    align-items: center;
    gap: 0.4em;
  }

  .drive-label {
    font-size: 0.56em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .xp-badge {
    font-size: 0.56em;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(26,122,60,0.1);
    color: var(--off-accent);
    border: 1px solid rgba(26,122,60,0.25);
  }

  .mastery-chip {
    font-size: 0.56em;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(13,35,71,0.07);
    color: var(--text-muted);
    border: 1px solid var(--border);
    cursor: help;
  }

  /* ── Situation strip ──────────────────────────────────────── */
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

  .side-toggle {
    display: flex;
    box-shadow: var(--neu-inset-sm);
    border-radius: 6px;
    overflow: hidden;
    padding: 2px;
    gap: 2px;
    margin-left: auto;
  }

  .side-btn {
    background: transparent;
    border: none;
    padding: 0.22em 0.7em;
    font-size: 0.73em;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.12s, color 0.12s;
  }

  .side-btn:hover { background: rgba(13,35,71,0.07); color: var(--text-primary); }
  .side-btn.active { background: var(--accent); color: #fff; }

  /* ── Playout ──────────────────────────────────────────────── */
  .playout-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-top: 0.5em;
    min-height: 0;
  }

  /* ── Drive over ───────────────────────────────────────────── */
  .drive-over-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.7em;
    padding: 1.5em 1em;
    text-align: center;
  }

  .drive-over-title {
    font-size: 1.6em;
    font-weight: 900;
    letter-spacing: 0.06em;
    font-family: monospace;
  }

  .drive-over-panel.score  .drive-over-title { color: var(--off-accent); }
  .drive-over-panel.bad    .drive-over-title { color: #b02820; }
  .drive-over-panel.neutral .drive-over-title { color: var(--text-primary); }

  .drive-over-scores, .drive-over-xp {
    display: flex;
    align-items: baseline;
    gap: 0.4em;
    font-size: 0.85em;
  }

  .dos-label {
    font-size: 0.65em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .dos-val { color: var(--text-primary); }

  .dos-xp {
    font-weight: 700;
    font-family: monospace;
    color: var(--off-accent);
  }

  .new-drive-btn {
    background: var(--accent);
    border: none;
    border-radius: 8px;
    padding: 0.5em 1.2em;
    font-size: 0.82em;
    font-weight: 800;
    letter-spacing: 0.06em;
    font-family: inherit;
    color: #fff;
    cursor: pointer;
    margin-top: 0.4em;
    box-shadow: 0 4px 14px rgba(13,35,71,0.45);
    transition: box-shadow 0.15s, transform 0.05s;
  }

  .new-drive-btn:hover {
    box-shadow: 0 6px 18px rgba(13,35,71,0.55);
    transform: translateY(-1px);
  }

  /* ── Coach body ───────────────────────────────────────────── */
  .coach-body {
    display: grid;
    grid-template-columns: 11.875em 1fr;
    gap: 1em;
    padding-top: 0.6em;
    min-height: 0;
  }

  /* ── Opponent panel ───────────────────────────────────────── */
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

  .opp-info { display: flex; flex-direction: column; gap: 0.3em; }

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
    background: var(--bg);
    border: none;
    border-radius: 6px;
    box-shadow: var(--neu-raised-sm);
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

  /* ── Call panel ───────────────────────────────────────────── */
  .call-panel {
    display: flex;
    flex-direction: column;
    gap: 0.55em;
  }

  /* 4th down */
  .fourth-sub {
    font-size: 0.75em;
    color: var(--text-muted);
    margin: 0;
  }

  .fourth-options {
    display: flex;
    flex-direction: column;
    gap: 0.35em;
  }

  .fourth-btn {
    background: var(--bg);
    border: none;
    border-radius: 7px;
    padding: 0.45em 0.75em;
    text-align: left;
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    display: flex;
    flex-direction: column;
    gap: 0.1em;
    transition: box-shadow 0.15s;
  }

  .fourth-btn:hover { box-shadow: var(--neu-raised); }
  .fourth-btn.go { outline: 2px solid rgba(13,35,71,0.3); outline-offset: -2px; }

  .fb-name {
    font-size: 0.8em;
    font-weight: 700;
    color: var(--text-primary);
  }

  .fourth-btn.go .fb-name { color: var(--accent); }

  .fb-desc {
    font-size: 0.64em;
    color: var(--text-muted);
  }

  /* Formation / play pickers */
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
    background: var(--bg);
    border: none;
    border-radius: 6px;
    padding: 0.38em 0.6em;
    text-align: left;
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.15s;
    display: flex;
    align-items: baseline;
    gap: 0.4em;
  }

  .formation-btn:hover:not(:disabled) { box-shadow: var(--neu-raised); }
  .formation-btn.selected {
    box-shadow: var(--neu-inset-sm);
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .formation-btn:disabled { opacity: 0.45; cursor: default; }

  .fbn-name { font-size: 0.78em; font-weight: 700; color: var(--text-primary); }
  .fbn-personnel { font-size: 0.62em; color: var(--text-muted); font-family: monospace; }

  .play-list { display: flex; flex-direction: column; gap: 0.22em; }

  .play-btn {
    background: var(--bg);
    border: none;
    border-radius: 6px;
    padding: 0.32em 0.65em;
    text-align: left;
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.15s;
    display: flex;
    flex-direction: column;
    gap: 0.1em;
  }

  .play-btn:hover:not(:disabled) { box-shadow: var(--neu-raised); }
  .play-btn.selected {
    box-shadow: var(--neu-inset-sm);
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .play-btn:disabled { opacity: 0.45; cursor: default; }

  .play-btn-top { display: flex; align-items: center; gap: 0.35em; }
  .play-name { font-size: 0.8em; font-weight: 700; color: var(--text-primary); }
  .play-desc { font-size: 0.67em; color: var(--text-muted); line-height: 1.3; }

  .tag {
    font-size: 0.56em;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 1px 5px;
    border-radius: 3px;
    border: none;
    color: var(--text-muted);
    background: var(--bg);
    box-shadow: var(--neu-inset-sm);
  }

  .picker-hint {
    font-size: 0.75em;
    color: var(--text-muted);
    padding: 0.3em 0;
  }

  .run-btn {
    background: var(--accent);
    border: none;
    border-radius: 8px;
    padding: 0.5em 1em;
    font-size: 0.8em;
    font-weight: 800;
    letter-spacing: 0.08em;
    font-family: inherit;
    color: #fff;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(13,35,71,0.45), 0 1px 3px rgba(13,35,71,0.3);
    transition: box-shadow 0.15s, transform 0.05s;
    margin-top: 0.25em;
  }

  .run-btn:hover:not(:disabled) {
    box-shadow: 0 6px 18px rgba(13,35,71,0.55), 0 2px 5px rgba(13,35,71,0.3);
    transform: translateY(-1px);
  }
  .run-btn:active:not(:disabled) { box-shadow: 0 2px 6px rgba(13,35,71,0.3); transform: translateY(0); }
  .run-btn:disabled { opacity: 0.35; cursor: default; }

  /* ── Outcome panel ────────────────────────────────────────── */
  .outcome-panel {
    background: var(--bg);
    box-shadow: var(--neu-raised);
    border-radius: 10px;
    padding: 0.75em 1em;
    margin-top: 0.4em;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3em;
  }

  .outcome-panel.turnover {
    box-shadow: 5px 5px 14px var(--shadow-dark), -5px -5px 14px var(--shadow-light), inset 0 3px 0 #b02820;
  }
  .outcome-panel.big-play {
    box-shadow: 5px 5px 14px var(--shadow-dark), -5px -5px 14px var(--shadow-light), inset 0 3px 0 var(--accent);
  }

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
  .yards-unit { font-size: 0.78em; font-weight: 600; color: var(--text-muted); }

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

  .score-badge {
    font-size: 0.65em;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .score-badge.excellent { background: rgba(26,122,60,0.10);  color: #1a7a3c; border: 1px solid rgba(26,122,60,0.3); }
  .score-badge.good      { background: rgba(26,122,60,0.06);  color: #2d8a56; border: 1px solid rgba(26,122,60,0.2); }
  .score-badge.neutral   { background: rgba(140,100,0,0.10);  color: #7a5800; border: 1px solid rgba(140,100,0,0.25); }
  .score-badge.poor      { background: rgba(176,40,32,0.10);  color: #b02820; border: 1px solid rgba(176,40,32,0.2); }

  .xp-earned {
    font-size: 0.62em;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--off-accent);
    padding: 2px 5px;
    border-radius: 3px;
    background: rgba(26,122,60,0.08);
    border: 1px solid rgba(26,122,60,0.2);
  }

  .outcome-spacer { flex: 1; }

  .breakdown-text {
    font-size: 0.78em;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
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
    background: var(--bg);
    border: none;
    border-radius: 6px;
    padding: 0.35em 0.85em;
    font-size: 0.75em;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-primary);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.15s;
  }

  .next-btn:hover { box-shadow: var(--neu-raised); }

  /* ── Clock urgency ────────────────────────────────────────── */
  .clock-urgent { color: #b02820 !important; animation: clock-pulse 1s ease-in-out infinite; }
  @keyframes clock-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

  .urgency-strip {
    font-size: 0.65em;
    font-weight: 700;
    letter-spacing: 0.07em;
    padding: 0.28em 0.75em;
    border-radius: 5px;
    margin: 0.2em 0;
    flex-shrink: 0;
  }
  .urgency-strip.hurry   { background: rgba(176,40,32,0.10); color: #b02820; border: 1px solid rgba(176,40,32,0.25); }
  .urgency-strip.protect { background: rgba(26,122,60,0.10);  color: #1a7a3c; border: 1px solid rgba(26,122,60,0.25); }
  .urgency-strip.warning { background: rgba(140,100,0,0.10);  color: #7a5800; border: 1px solid rgba(140,100,0,0.25); }

  /* ── Game over ────────────────────────────────────────────── */
  .game-over-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75em;
    padding: 2em 1em;
    text-align: center;
  }

  .game-over-quarter {
    font-size: 0.72em;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: var(--text-muted);
  }

  .game-over-score {
    display: flex;
    align-items: baseline;
    gap: 0.35em;
  }

  .go-num {
    font-size: 2.2em;
    font-weight: 900;
    font-family: monospace;
    line-height: 1;
  }
  .go-num.off { color: var(--off-accent); }
  .go-num.def { color: var(--accent); }

  .go-dash { font-size: 1.4em; color: var(--text-muted); }

  .go-side {
    font-size: 0.62em;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    align-self: center;
  }

  .go-xp {
    font-size: 0.78em;
    color: var(--text-secondary);
  }

  .go-xp strong { color: var(--off-accent); }

  .go-buttons { margin-top: 0.5em; }

  /* ── Personnel picker ─────────────────────────────────────── */
  .personnel-list {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
  }

  .personnel-btn {
    background: var(--bg);
    border: none;
    border-radius: 7px;
    padding: 0.42em 0.7em;
    text-align: left;
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    display: flex;
    align-items: center;
    gap: 0.55em;
    transition: box-shadow 0.15s;
  }
  .personnel-btn:hover { box-shadow: var(--neu-raised); }

  .pkg-abbr {
    font-size: 0.78em;
    font-weight: 900;
    font-family: monospace;
    color: var(--accent);
    min-width: 1.8em;
    text-align: center;
  }

  .pkg-info { display: flex; flex-direction: column; gap: 0.08em; }
  .pkg-name { font-size: 0.78em; font-weight: 700; color: var(--text-primary); }
  .pkg-desc { font-size: 0.62em; color: var(--text-muted); font-family: monospace; }

  /* Selected package banner */
  .pkg-selected-row {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.32em 0.65em;
    background: var(--bg);
    border-radius: 6px;
    box-shadow: var(--neu-inset-sm);
    flex-shrink: 0;
  }

  .pkg-badge {
    font-size: 0.7em;
    font-weight: 900;
    font-family: monospace;
    color: var(--accent);
    background: rgba(13,35,71,0.07);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 1px 5px;
  }

  .pkg-sel-info { display: flex; flex-direction: column; gap: 0.06em; flex: 1; min-width: 0; }
  .pkg-sel-name { font-size: 0.72em; font-weight: 700; color: var(--text-primary); }
  .pkg-sel-hint { font-size: 0.61em; color: var(--text-muted); line-height: 1.3; }

  .pkg-change-btn {
    background: none;
    border: none;
    font-size: 0.85em;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0 0.2em;
    flex-shrink: 0;
  }
  .pkg-change-btn:hover { color: var(--text-primary); }

  /* ── Motion button ────────────────────────────────────────── */
  .motion-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.32em 0.75em;
    font-size: 0.72em;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-secondary);
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.12s, color 0.12s;
    align-self: flex-start;
  }
  .motion-btn:hover { box-shadow: var(--neu-raised); color: var(--text-primary); }

  .motion-reveal {
    font-size: 0.7em;
    line-height: 1.4;
    color: var(--text-secondary);
    background: rgba(13,35,71,0.05);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.4em 0.65em;
  }
  .motion-reveal strong { color: var(--text-primary); }

  /* ── Audible button ───────────────────────────────────────── */
  .audible-btn {
    background: var(--bg);
    border: 1px dashed var(--border);
    border-radius: 6px;
    padding: 0.28em 0.7em;
    font-size: 0.7em;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s;
    align-self: flex-start;
  }
  .audible-btn:hover { color: var(--text-primary); border-color: var(--text-muted); }

  .audible-notice {
    font-size: 0.67em;
    color: var(--off-accent);
    font-weight: 600;
    letter-spacing: 0.04em;
  }
</style>
