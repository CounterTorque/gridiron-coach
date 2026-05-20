<script>
  import { onMount } from 'svelte';
  import Sandbox from './routes/Sandbox.svelte';
  import Coach from './routes/Coach.svelte';
  import Tutorial from './routes/Tutorial.svelte';
  import Drill from './routes/Drill.svelte';
  import GlossaryDrawer from './lib/components/GlossaryDrawer.svelte';
  import { glossaryOpen, activeRoute } from './lib/stores/ui.js';

  const STAGE_W = 1152;
  const STAGE_H = 864;

  let stageEl;
  let scale = 1;

  function updateScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    scale = Math.min(vw / STAGE_W, vh / STAGE_H);
  }

  onMount(() => {
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  });

  function toggleGlossary() {
    glossaryOpen.update(v => !v);
  }

  const routes = [
    { id: 'sandbox',  label: 'Sandbox' },
    { id: 'coach',    label: 'Coach Mode' },
    { id: 'drill',    label: 'Drill' },
    { id: 'tutorial', label: 'Tutorial' },
  ];
</script>

<div
  class="stage"
  bind:this={stageEl}
  style="transform: scale({scale}); width: {STAGE_W}px; height: {STAGE_H}px;"
>
  <header class="topbar">
    <div class="topbar-left">
      <span class="logo">GRIDIRON COACH</span>
      <nav class="nav">
        {#each routes as r}
          <button
            class="nav-btn"
            class:active={$activeRoute === r.id}
            disabled={r.disabled}
            onclick={() => !r.disabled && activeRoute.set(r.id)}
            title={r.disabled ? 'Coming in Phase 1+' : undefined}
          >
            {r.label}
            {#if r.disabled}<span class="soon">soon</span>{/if}
          </button>
        {/each}
      </nav>
    </div>
    <button class="glossary-btn" onclick={toggleGlossary}>
      Glossary
    </button>
  </header>

  <main class="main-content">
    {#if $activeRoute === 'sandbox'}
      <Sandbox />
    {:else if $activeRoute === 'coach'}
      <Coach />
    {:else if $activeRoute === 'drill'}
      <Drill />
    {:else if $activeRoute === 'tutorial'}
      <Tutorial on:done={() => activeRoute.set('coach')} />
    {/if}
  </main>

  <GlossaryDrawer />
</div>

<style>
  .stage {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--text-primary);
    overflow: hidden;
    transform-origin: center center;
    flex-shrink: 0;
  }

  .topbar {
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.25rem;
    flex-shrink: 0;
    background: var(--bg);
    box-shadow: 0 2px 8px var(--shadow-dark), 0 -1px 0 var(--shadow-light);
    position: relative;
    z-index: 10;
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .logo {
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--accent);
    font-family: monospace;
  }

  .nav {
    display: flex;
    gap: 0.25rem;
  }

  .nav-btn {
    background: var(--bg);
    border: none;
    padding: 0.3rem 0.65rem;
    font-size: 0.8rem;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    transition: box-shadow 0.15s, color 0.15s;
  }

  .nav-btn:not(:disabled):hover {
    box-shadow: var(--neu-raised-sm);
    color: var(--text-primary);
  }

  .nav-btn.active {
    color: var(--accent);
    box-shadow: var(--neu-inset-sm);
  }

  .nav-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .soon {
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 0 3px;
    line-height: 1.5;
  }

  .glossary-btn {
    background: var(--bg);
    border: none;
    border-radius: 6px;
    padding: 0.3rem 0.75rem;
    font-size: 0.78rem;
    font-family: inherit;
    color: var(--accent);
    cursor: pointer;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.15s;
  }

  .glossary-btn:hover {
    box-shadow: var(--neu-raised);
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }
</style>
