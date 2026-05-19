<script>
  import { glossaryOpen, glossaryTerm } from '../stores/ui.js';
  import positionsData from '../../data/positions.json';

  export let abbr = '';
  export let x = 0;
  export let y = 0;
  export let visible = false;

  $: posData = positionsData.find(p => p.abbr === abbr);

  function openGlossary() {
    if (!posData) return;
    glossaryTerm.set(posData.name);
    glossaryOpen.set(true);
  }
</script>

{#if visible && posData}
  <foreignObject
    x={Math.min(Math.max(x - 17, 1), 60)}
    y={y < 68 ? y + 4 : y - 28}
    width="38"
    height="26"
    style="overflow: visible; pointer-events: none;"
  >
    <div class="tooltip" xmlns="http://www.w3.org/1999/xhtml">
      <div class="tt-name">{posData.name}</div>
      <div class="tt-resp">{posData.responsibilities[0]}</div>
    </div>
  </foreignObject>
{/if}

<style>
  .tooltip {
    background: #0f1923;
    border: 1px solid #2a3a4a;
    border-radius: 4px;
    padding: 6px 8px;
    min-width: 160px;
    max-width: 220px;
    pointer-events: none;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    position: absolute;
    white-space: normal;
    z-index: 50;
  }

  .tt-name {
    font-size: 11px;
    font-weight: 700;
    color: #e8c53a;
    margin-bottom: 3px;
    letter-spacing: 0.04em;
  }

  .tt-resp {
    font-size: 10px;
    color: #8ba0b0;
    line-height: 1.4;
  }
</style>
