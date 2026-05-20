<script>
  import { onMount, onDestroy } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let offFormation = null;
  export let defFormation = null;
  export let offPlay = null;
  export let result = null;
  export let onDone = () => {};

  const OFF_COLOR  = '#1a7a3c';
  const DEF_COLOR  = '#0d2347';
  const OFF_STROKE = '#3dcc7a';
  const DEF_STROKE = '#4a7abf';
  const LOS = 60;

  const mirrorY = y => 120 - y;

  // Animation phases
  let phase = 0; // 0=presnap 1=snap 2=routes 3=ball-moving 4=done

  // Ball position — tweened for smooth SVG-unit animation
  const ballX = tweened(50,         { duration: 1500, easing: cubicOut });
  const ballY = tweened(LOS + 2,    { duration: 1500, easing: cubicOut });

  let routesVisible = false;
  let routeLines = [];

  // Compute final ball position
  function finalX() {
    if (!offPlay || !offFormation) return 50;
    if (result?.turnover) return 50;
    if (offPlay.type === 'run' || offPlay.type === 'option') {
      const rb = offFormation.positions.find(p => p.abbr === 'RB' || p.abbr === 'FB');
      return rb ? rb.x : 50;
    }
    // pass — target a receiver
    const recvs = offFormation.positions.filter(p => ['WR', 'TE'].includes(p.abbr));
    if (!recvs.length) return 50;
    const isShort = offPlay.id?.includes('screen') || offPlay.id?.includes('quick') || offPlay.id?.includes('slant');
    return isShort ? recvs[0].x : (recvs[Math.floor(recvs.length / 2)]?.x ?? 50);
  }

  function finalY() {
    if (!result) return LOS;
    if (result.turnover) return LOS + 4;
    const y = LOS - result.yards * 1.5;
    return Math.max(4, Math.min(LOS + 8, y));
  }

  function buildRoutes() {
    if (!offFormation || !offPlay) return [];
    const lines = [];
    if (offPlay.type === 'run' || offPlay.type === 'option') {
      const carriers = offFormation.positions.filter(p => ['RB', 'FB'].includes(p.abbr));
      for (const pos of carriers) {
        const dirX = pos.x > 52 ? 6 : pos.x < 48 ? -6 : 0;
        lines.push({ x1: pos.x, y1: pos.y, x2: pos.x + dirX, y2: Math.max(38, pos.y - 18) });
      }
    } else {
      const recvs = offFormation.positions.filter(p => ['WR', 'TE'].includes(p.abbr));
      const isDeep = offPlay.id?.includes('deep') || offPlay.id?.includes('shot');
      const isScreen = offPlay.id?.includes('screen');
      recvs.slice(0, 4).forEach((pos, i) => {
        let ex = pos.x, ey = pos.y;
        if (isDeep) {
          ey = Math.max(6, pos.y - 42);
          ex = pos.x + (pos.x > 50 ? 4 : -4);
        } else if (isScreen) {
          ey = pos.y + 4;
          ex = pos.x + (pos.x > 50 ? 10 : -10);
        } else {
          const r = i % 3;
          ey = Math.max(18, pos.y - (13 + i * 5));
          ex = pos.x + (r === 0 ? 11 : r === 1 ? -9 : 1);
        }
        lines.push({ x1: pos.x, y1: pos.y, x2: ex, y2: ey });
      });
    }
    return lines;
  }

  let timers = [];
  const after = (ms, fn) => { timers.push(setTimeout(fn, ms)); };

  onMount(() => {
    routeLines = buildRoutes();
    after(250,  () => { phase = 1; });
    after(650,  () => { routesVisible = true; phase = 2; });
    after(1200, () => {
      ballX.set(finalX());
      ballY.set(finalY());
      phase = 3;
    });
    after(3000, () => { phase = 4; onDone(); });
  });

  onDestroy(() => timers.forEach(clearTimeout));

  function skip() {
    timers.forEach(clearTimeout);
    timers = [];
    ballX.set(finalX(), { duration: 0 });
    ballY.set(finalY(), { duration: 0 });
    phase = 4;
    onDone();
  }
</script>

<div class="playout-wrap">
  <svg viewBox="0 0 100 110" class="playout-svg" aria-label="Play animation">

    <!-- Field -->
    <rect width="100" height="110" fill="#2d7a3a"/>
    <line x1="0" y1="0"   x2="0"   y2="110" stroke="rgba(255,255,255,0.6)" stroke-width="0.5"/>
    <line x1="100" y1="0" x2="100" y2="110" stroke="rgba(255,255,255,0.6)" stroke-width="0.5"/>

    {#each [10,20,30,40,50,70,80,90,100] as yl}
      <line x1="0" y1={yl} x2="100" y2={yl} stroke="rgba(255,255,255,0.2)" stroke-width="0.3"/>
    {/each}

    <!-- LOS -->
    <line x1="0" y1={LOS} x2="100" y2={LOS}
      stroke="rgba(255,255,255,0.8)" stroke-width="0.5" stroke-dasharray="3,2"/>
    <text x="1.5" y="59" font-size="1.8" fill="rgba(255,255,255,0.5)" font-family="monospace">LOS</text>

    <!-- Offense end-zone tint -->
    <rect x="0" y="0" width="100" height="8" fill="rgba(26,122,60,0.25)"/>
    <!-- Defense end-zone tint -->
    <rect x="0" y="102" width="100" height="8" fill="rgba(13,35,71,0.25)"/>

    <!-- Defense players (mirrored so their secondary is above LOS) -->
    {#if defFormation}
      {#each defFormation.positions as pos}
        {@const my = mirrorY(pos.y)}
        <circle cx={pos.x} cy={my} r="3.2" fill={DEF_COLOR} stroke={DEF_STROKE} stroke-width="0.5" opacity="0.9"/>
        <text x={pos.x} y={my + 0.4} text-anchor="middle" dominant-baseline="middle"
          fill="white" font-size="1.8" font-weight="700" font-family="monospace" pointer-events="none">
          {pos.abbr}
        </text>
      {/each}
    {/if}

    <!-- Offense players -->
    {#if offFormation}
      {#each offFormation.positions as pos}
        <circle cx={pos.x} cy={pos.y} r="3.2" fill={OFF_COLOR} stroke={OFF_STROKE} stroke-width="0.5" opacity="0.9"/>
        <text x={pos.x} y={pos.y + 0.4} text-anchor="middle" dominant-baseline="middle"
          fill="white" font-size="1.8" font-weight="700" font-family="monospace" pointer-events="none">
          {pos.abbr}
        </text>
      {/each}
    {/if}

    <!-- Route lines -->
    {#if routesVisible}
      {#each routeLines as ln}
        <line x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
          stroke="rgba(255,255,255,0.55)" stroke-width="0.7"
          stroke-dasharray="2,1.5" class="route-line"/>
        <!-- arrowhead -->
        <circle cx={ln.x2} cy={ln.y2} r="0.9" fill="rgba(255,255,255,0.7)" class="route-line"/>
      {/each}
    {/if}

    <!-- Ball (football icon, tweened position via SVG transform) -->
    {#if phase >= 1}
      <g transform="translate({$ballX} {$ballY})" class="football">
        <!-- Body -->
        <ellipse rx="1.45" ry="2.5" fill="#c67c3a" stroke="#7a3f0a" stroke-width="0.35"/>
        <!-- Longitudinal seam -->
        <line x1="0" y1="-2.5" x2="0" y2="2.5" stroke="white" stroke-width="0.22" opacity="0.65"/>
        <!-- Laces (3 crossbars centered on seam) -->
        <line x1="-0.7" y1="-0.85" x2="0.7" y2="-0.85" stroke="white" stroke-width="0.3" opacity="0.9" stroke-linecap="round"/>
        <line x1="-0.85" y1="0"    x2="0.85" y2="0"    stroke="white" stroke-width="0.35" opacity="0.95" stroke-linecap="round"/>
        <line x1="-0.7" y1="0.85"  x2="0.7" y2="0.85"  stroke="white" stroke-width="0.3" opacity="0.9" stroke-linecap="round"/>
        <!-- Turnover X overlay -->
        {#if phase >= 4 && result?.turnover}
          <text y="1" text-anchor="middle" dominant-baseline="middle"
            font-size="5.5" fill="rgba(200,50,50,0.95)" stroke="rgba(255,255,255,0.5)" stroke-width="0.3">✕</text>
        {/if}
      </g>
    {/if}
  </svg>

  <div class="playout-controls">
    <button class="skip-btn" onclick={skip} disabled={phase >= 4}>Skip</button>
  </div>
</div>

<style>
  .playout-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.3em;
    width: 100%;
  }

  .playout-svg {
    width: 100%;
    height: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
    display: block;
    box-shadow: var(--neu-raised-sm);
  }

  .route-line {
    animation: routeFade 0.5s ease-in forwards;
  }

  @keyframes routeFade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .playout-controls {
    display: flex;
    justify-content: flex-end;
  }

  .skip-btn {
    background: var(--bg);
    border: none;
    border-radius: 5px;
    padding: 0.2em 0.65em;
    font-size: 0.68em;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.15s, color 0.15s;
  }

  .skip-btn:hover:not(:disabled) {
    box-shadow: var(--neu-raised);
    color: var(--text-primary);
  }

  .skip-btn:disabled { opacity: 0.35; cursor: default; }
</style>
