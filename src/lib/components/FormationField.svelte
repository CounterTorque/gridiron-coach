<script>
  import PositionTooltip from './PositionTooltip.svelte';
  import { glossaryOpen, glossaryTerm } from '../stores/ui.js';
  import positionsData from '../../data/positions.json';

  export let formation = null;
  export let showTells = false;
  export let compact = false;

  let hoveredIdx = null;

  const FIELD_W = 100;
  const FIELD_H = 100;

  const OFF_COLOR = '#1a6e3c';
  const DEF_COLOR = '#1a3a6e';
  const OFF_STROKE = '#2aaf60';
  const DEF_STROKE = '#2a60af';
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
    viewBox="0 0 100 100"
    class="field-svg"
    role="img"
    aria-label={formation ? `${formation.name} formation diagram` : 'Football field'}
  >
    <!-- Field background -->
    <rect width="100" height="100" fill="#1a2a18" />

    <!-- Yard lines (every 5 yards shown as subtle lines) -->
    {#each [10,20,30,40,50,60,70,80,90] as yard}
      <line
        x1={yard} y1="0" x2={yard} y2="100"
        stroke="#2a3a28" stroke-width="0.3"
      />
    {/each}

    <!-- Hash marks -->
    {#each [10,20,30,40,50,60,70,80,90] as yard}
      <line x1={yard-0.4} y1="42" x2={yard+0.4} y2="42" stroke="#3a4a38" stroke-width="0.3" />
      <line x1={yard-0.4} y1="58" x2={yard+0.4} y2="58" stroke="#3a4a38" stroke-width="0.3" />
    {/each}

    <!-- Line of scrimmage -->
    <line x1="0" y1="50" x2="100" y2="50" stroke="#3a5a38" stroke-width="0.2" stroke-dasharray="2,2" />

    <!-- Neutral zone (between offense and defense) -->
    <rect x="0" y="48.5" width="100" height="3" fill="rgba(255,220,0,0.04)" />

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
            r="3.8"
            fill={dotColor}
            stroke={strokeColor}
            stroke-width={hoveredIdx === i ? '0.8' : '0.5'}
            opacity={hoveredIdx === i ? 1 : 0.92}
          />
          <text
            x={pos.x}
            y={pos.y + 0.4}
            text-anchor="middle"
            dominant-baseline="middle"
            fill={LABEL_COLOR}
            font-size="2.2"
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
      <!-- Empty field hint -->
      <text x="50" y="50" text-anchor="middle" dominant-baseline="middle" fill="#3a5a38" font-size="4" font-family="sans-serif">
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
    border: 1px solid #2a3a28;
    border-radius: 4px;
    display: block;
  }

  .player-dot {
    cursor: pointer;
  }

  .player-dot:focus {
    outline: none;
  }

  .player-dot:focus circle {
    stroke: #e8c53a;
    stroke-width: 0.8px;
  }

  .tells-panel {
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.6rem 0.875rem;
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
