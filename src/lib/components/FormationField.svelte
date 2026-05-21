<script>
  import positionsData from '../../data/positions.json';

  export let formation = null;
  export let showTells = false;
  export let compact = false;

  let hoveredIdx = null;

  const LOS_Y = 60;

  const OFF_COLOR = '#1a7a3c';
  const DEF_COLOR = '#0d2347';
  const OFF_STROKE = '#3dcc7a';
  const DEF_STROKE = '#4a7abf';
  const LABEL_COLOR = '#ffffff';

  function onEnter(idx) { hoveredIdx = idx; }
  function onLeave() { hoveredIdx = null; }

  $: isOffense = formation?.side === 'offense';
  $: dotColor = isOffense ? OFF_COLOR : DEF_COLOR;
  $: strokeColor = isOffense ? OFF_STROKE : DEF_STROKE;

  $: hoveredPos = hoveredIdx !== null && formation?.positions
    ? formation.positions[hoveredIdx]
    : null;

  $: hoveredPosData = hoveredPos
    ? positionsData.find(p => p.abbr === hoveredPos.abbr)
    : null;

  // Tooltip position mapping: viewBox y range is 20–90 (height 70)
  $: ttLeft  = hoveredPos ? hoveredPos.x : 50;
  $: ttTop   = hoveredPos ? (hoveredPos.y - 20) / 70 * 100 : 50;
  $: ttAbove = hoveredPos ? hoveredPos.y > 55 : false;
  // Anchor: left-edge dots (x ≤ 15) pin the tooltip's left side; right-edge (x ≥ 85) pin the right side
  $: ttEdge  = hoveredPos
    ? (hoveredPos.x <= 15 ? 'left' : hoveredPos.x >= 85 ? 'right' : 'center')
    : 'center';
</script>

<div class="field-wrap" class:compact>
  <div class="svg-wrap">
    <svg
      viewBox="0 20 100 70"
      class="field-svg"
      role="img"
      aria-label={formation ? `${formation.name} formation diagram` : 'Football field'}
    >
      <!-- Field background -->
      <rect x="0" y="20" width="100" height="70" fill="#2d7a3a" />

      <!-- Sidelines -->
      <line x1="0" y1="20" x2="0" y2="90" stroke="rgba(255,255,255,0.75)" stroke-width="0.5" />
      <line x1="100" y1="20" x2="100" y2="90" stroke="rgba(255,255,255,0.75)" stroke-width="0.5" />

      <!-- Horizontal yard lines (visible in y=20–90 window) -->
      {#each [20, 30, 40, 50, 70, 80, 90] as yLine}
        <line x1="0" y1={yLine} x2="100" y2={yLine} stroke="rgba(255,255,255,0.35)" stroke-width="0.3" />
      {/each}

      <!-- Hash marks -->
      {#each [20, 30, 40, 50, 70, 80, 90] as yLine}
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
          <g
            class="player-dot"
            role="img"
            aria-label={pos.abbr}
            onmouseenter={() => onEnter(i)}
            onmouseleave={onLeave}
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
      {:else}
        <text x="50" y="55" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.3)" font-size="4" font-family="sans-serif">
          Select a formation
        </text>
      {/if}
    </svg>

    <!-- HTML tooltip overlay — real CSS pixels, correct z-index, no SVG scaling issues -->
    {#if hoveredPos && hoveredPosData}
      <div
        class="pos-tooltip"
        class:above={ttAbove}
        class:edge-left={ttEdge === 'left'}
        class:edge-right={ttEdge === 'right'}
        style="left: {ttLeft}%; top: {ttTop}%;"
      >
        <div class="tt-name">{hoveredPosData.name}</div>
        <div class="tt-resp">{hoveredPosData.responsibilities[0]}</div>
      </div>
    {/if}
  </div>

  {#if formation && showTells && formation.tells?.length}
    <div class="tells-panel" class:compact>
      <div class="tells-label">TELLS</div>
      <ul class="tells-list">
        {#each (compact ? formation.tells.slice(0, 2) : formation.tells) as tell}
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

  .svg-wrap {
    position: relative;
    width: 100%;
    line-height: 0;
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
    cursor: default;
  }

  .pos-tooltip {
    position: absolute;
    transform: translate(-50%, 6px);
    pointer-events: none;
    background: rgba(13, 35, 71, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 5px;
    padding: 5px 8px;
    width: max-content;
    max-width: 160px;
    white-space: normal;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    z-index: 30;
  }

  .pos-tooltip.above {
    transform: translate(-50%, calc(-100% - 6px));
  }

  .pos-tooltip.edge-left {
    transform: translate(-4px, 6px);
  }
  .pos-tooltip.edge-left.above {
    transform: translate(-4px, calc(-100% - 6px));
  }

  .pos-tooltip.edge-right {
    transform: translate(calc(-100% + 4px), 6px);
  }
  .pos-tooltip.edge-right.above {
    transform: translate(calc(-100% + 4px), calc(-100% - 6px));
  }

  .tt-name {
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 2px;
    letter-spacing: 0.05em;
  }

  .tt-resp {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.4;
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
    height: 160px;
    width: auto;
    margin: 0 auto;
  }

  .compact .tells-panel {
    padding: 0.4rem 0.6rem;
  }

  .compact .tells-list li {
    font-size: 0.72rem;
  }
</style>
