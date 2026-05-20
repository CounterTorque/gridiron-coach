<script>
  import PositionTooltip from './PositionTooltip.svelte';
  import { glossaryOpen, glossaryTerm } from '../stores/ui.js';
  import positionsData from '../../data/positions.json';

  export let formation = null;
  export let showTells = false;
  export let compact = false;

  let hoveredIdx = null;

  const FIELD_W = 100;
  const FIELD_H = 110;
  const LOS_Y = 60; // line of scrimmage y-coordinate

  const OFF_COLOR = '#1a7a3c';
  const DEF_COLOR = '#0d2347';
  const OFF_STROKE = '#3dcc7a';
  const DEF_STROKE = '#4a7abf';
  const LABEL_COLOR = '#ffffff';

  function onEnter(idx) { hoveredIdx = idx; }
  function onLeave() { hoveredIdx = null; }

  function onClickPosition(abbr) {
    const pos = positionsData.find(p => p.abbr === abbr);
    if (pos) {
      glossaryTerm.set(pos.name);
      glossaryOpen.set(true);
    }
  }

  $: isOffense = formation?.side === 'offense';
  $: dotColor = isOffense ? OFF_COLOR : DEF_COLOR;
  $: strokeColor = isOffense ? OFF_STROKE : DEF_STROKE;

  $: hoveredPos = hoveredIdx !== null && formation?.positions
    ? formation.positions[hoveredIdx]
    : null;
</script>

<div class="field-wrap" class:compact>
  <svg
    viewBox="0 0 100 110"
    class="field-svg"
    role="img"
    aria-label={formation ? `${formation.name} formation diagram` : 'Football field'}
  >
    <!-- Field background -->
    <rect width="100" height="110" fill="#2d7a3a" />

    <!-- Sidelines -->
    <line x1="0" y1="0" x2="0" y2="110" stroke="rgba(255,255,255,0.75)" stroke-width="0.5" />
    <line x1="100" y1="0" x2="100" y2="110" stroke="rgba(255,255,255,0.75)" stroke-width="0.5" />

    <!-- Horizontal yard lines (every ~5 yds of the visible window) -->
    {#each [10, 20, 30, 40, 50, 70, 80, 90, 100] as yLine}
      <line x1="0" y1={yLine} x2="100" y2={yLine} stroke="rgba(255,255,255,0.35)" stroke-width="0.3" />
    {/each}

    <!-- Hash marks — two columns of vertical ticks, ~35 and ~65 across (NFL hash proportions) -->
    {#each [10, 20, 30, 40, 50, 70, 80, 90, 100] as yLine}
      <line x1="36" y1={yLine - 0.7} x2="36" y2={yLine + 0.7} stroke="rgba(255,255,255,0.45)" stroke-width="0.35" />
      <line x1="64" y1={yLine - 0.7} x2="64" y2={yLine + 0.7} stroke="rgba(255,255,255,0.45)" stroke-width="0.35" />
    {/each}

    <!-- Neutral zone band -->
    <rect x="0" y="58.5" width="100" height="3" fill="rgba(255,220,0,0.07)" />

    <!-- Line of scrimmage -->
    <line x1="0" y1="60" x2="100" y2="60" stroke="rgba(255,255,255,0.8)" stroke-width="0.5" stroke-dasharray="3,2" />

    <!-- "LOS" label -->
    <text x="1.5" y="59" font-size="1.8" fill="rgba(255,255,255,0.6)" font-family="monospace" opacity="0.9">LOS</text>

    {#if formation}
      <!-- Player dots -->
      {#each formation.positions as pos, i}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <g
          class="player-dot"
          onmouseenter={() => onEnter(i)}
          onmouseleave={onLeave}
          onclick={() => onClickPosition(pos.abbr)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && onClickPosition(pos.abbr)}
          aria-label="{pos.abbr} — click for details"
        >
          <circle
            cx={pos.x}
            cy={pos.y}
            r="3.2"
            fill={dotColor}
            stroke={strokeColor}
            stroke-width={hoveredIdx === i ? '0.9' : '0.5'}
            opacity={hoveredIdx === i ? 1 : 0.93}
          />
          <text
            x={pos.x}
            y={pos.y + 0.4}
            text-anchor="middle"
            dominant-baseline="middle"
            fill={LABEL_COLOR}
            font-size="1.9"
            font-weight="700"
            font-family="monospace"
            pointer-events="none"
          >{pos.abbr}</text>
        </g>
      {/each}

      <!-- Tooltip for hovered player -->
      {#if hoveredPos}
        <PositionTooltip
          abbr={hoveredPos.abbr}
          x={hoveredPos.x}
          y={hoveredPos.y}
          visible={true}
        />
      {/if}
    {:else}
      <text x="50" y="60" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.3)" font-size="4" font-family="sans-serif">
        Select a formation
      </text>
    {/if}
  </svg>

  {#if formation && showTells && formation.tells?.length}
    <div class="tells-panel">
      <div class="tells-label">TELLS</div>
      <ul class="tells-list">
        {#each formation.tells as tell}
          <li>{tell}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .field-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .field-svg {
    width: 100%;
    height: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
    display: block;
    box-shadow: var(--neu-raised-sm);
  }

  .player-dot {
    cursor: pointer;
  }

  .player-dot:focus {
    outline: none;
  }

  .player-dot:focus circle {
    stroke: #ffffff;
    stroke-width: 0.8px;
  }

  .tells-panel {
    background: var(--bg);
    border: none;
    border-radius: 6px;
    padding: 0.6rem 0.875rem;
    box-shadow: var(--neu-raised-sm);
  }

  .tells-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-bottom: 0.35rem;
  }

  .tells-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .tells-list li {
    font-size: 0.78rem;
    color: var(--text-secondary);
    padding-left: 0.75rem;
    position: relative;
    line-height: 1.4;
  }

  .tells-list li::before {
    content: '›';
    position: absolute;
    left: 0;
    color: var(--accent-muted);
  }

  .compact .field-svg {
    border-radius: 2px;
  }
</style>
