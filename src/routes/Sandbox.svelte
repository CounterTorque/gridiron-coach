<script>
  import FormationField from '../lib/components/FormationField.svelte';
  import FormationCard from '../lib/components/FormationCard.svelte';
  import { glossaryOpen, glossaryTerm } from '../lib/stores/ui.js';
  import formationsData from '../data/formations.json';
  import positionsData from '../data/positions.json';

  let selectedFormation = formationsData[0];
  let showTells = true;
  let activeTab = 'formations'; // 'formations' | 'positions'
  let sideFilter = 'all'; // 'all' | 'offense' | 'defense'
  let selectedPosition = null;

  $: formationsFiltered = sideFilter === 'all'
    ? formationsData
    : formationsData.filter(f => f.side === sideFilter);

  $: positionsFiltered = sideFilter === 'all'
    ? positionsData
    : positionsData.filter(p => p.side === sideFilter);

  function selectFormation(f) {
    selectedFormation = f;
  }

  function openPositionDetail(p) {
    selectedPosition = p;
  }

  function openGlossaryTerm(term) {
    glossaryTerm.set(term);
    glossaryOpen.set(true);
  }
</script>

<div class="sandbox">
  <div class="sandbox-left">
    <div class="panel-header">
      <h2>Sandbox</h2>
      <p class="panel-subtitle">Explore formations and positions. Hover any player dot on the field for a quick look; click to go deeper.</p>
    </div>

    <!-- Tab bar -->
    <div class="tab-bar">
      <button
        class="tab"
        class:active={activeTab === 'formations'}
        onclick={() => activeTab = 'formations'}
      >Formations</button>
      <button
        class="tab"
        class:active={activeTab === 'positions'}
        onclick={() => activeTab = 'positions'}
      >Positions</button>
    </div>

    <!-- Side filter -->
    <div class="filter-bar">
      {#each ['all','offense','defense'] as f}
        <button
          class="filter-btn"
          class:active={sideFilter === f}
          onclick={() => sideFilter = f}
        >{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
      {/each}
    </div>

    {#if activeTab === 'formations'}
      <div class="list-scroll">
        {#each formationsFiltered as f}
          <FormationCard
            formation={f}
            selected={selectedFormation?.id === f.id}
            onClick={() => selectFormation(f)}
          />
        {/each}
      </div>
    {:else}
      <!-- Position selected detail -->
      {#if selectedPosition}
        <div class="pos-detail">
          <button class="back-btn" onclick={() => selectedPosition = null}>← All Positions</button>
          <div class="pos-detail-header">
            <span class="pos-abbr" class:offense={selectedPosition.side === 'offense'} class:defense={selectedPosition.side === 'defense'}>
              {selectedPosition.abbr}
            </span>
            <div>
              <h3>{selectedPosition.name}</h3>
              <span class="pos-side">{selectedPosition.side}</span>
            </div>
          </div>
          <div class="pos-section">
            <div class="section-label">RESPONSIBILITIES</div>
            <ul class="resp-list">
              {#each selectedPosition.responsibilities as r}
                <li>{r}</li>
              {/each}
            </ul>
          </div>
          <div class="pos-section">
            <div class="section-label">COACHING NOTE</div>
            <p class="pos-notes">{selectedPosition.notes}</p>
          </div>
          <button class="glossary-link" onclick={() => openGlossaryTerm(selectedPosition.name)}>
            See in Glossary →
          </button>
        </div>
      {:else}
        <div class="list-scroll">
          {#each positionsFiltered as p}
            <button class="pos-row" onclick={() => openPositionDetail(p)}>
              <span class="pos-abbr-sm" class:offense={p.side === 'offense'} class:defense={p.side === 'defense'}>
                {p.abbr}
              </span>
              <div class="pos-row-text">
                <span class="pos-row-name">{p.name}</span>
                <span class="pos-row-resp">{p.responsibilities[0]}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <div class="sandbox-right">
    {#if activeTab === 'formations' && selectedFormation}
      <div class="field-panel">
        <div class="field-header">
          <div>
            <h3 class="field-title">{selectedFormation.name}</h3>
            <span class="field-personnel">{selectedFormation.personnelLabel}</span>
          </div>
          <label class="tells-toggle">
            <input type="checkbox" bind:checked={showTells} />
            Show Tells
          </label>
        </div>

        <FormationField formation={selectedFormation} showTells={showTells} />

        <div class="formation-detail">
          <p class="formation-desc">{selectedFormation.description}</p>

          <div class="sw-grid">
            <div class="sw-col">
              <div class="section-label">STRENGTHS</div>
              <ul class="sw-list strengths">
                {#each selectedFormation.strengths as s}
                  <li>{s}</li>
                {/each}
              </ul>
            </div>
            <div class="sw-col">
              <div class="section-label">WEAKNESSES</div>
              <ul class="sw-list weaknesses">
                {#each selectedFormation.weaknesses as w}
                  <li>{w}</li>
                {/each}
              </ul>
            </div>
          </div>
        </div>
      </div>
    {:else if activeTab === 'positions'}
      <div class="field-panel">
        <div class="field-header">
          <h3 class="field-title">Formation Reference</h3>
        </div>
        {#each formationsData.slice(0,2) as f}
          <div class="compact-formation">
            <div class="compact-label">{f.name}</div>
            <FormationField formation={f} showTells={false} compact={true} />
          </div>
        {/each}
        <p class="positions-hint">Click any player dot on the field to see their role in that formation.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .sandbox {
    display: grid;
    grid-template-columns: 340px 1fr;
    grid-template-rows: 1fr;
    gap: 1.5rem;
    height: 100%;
    overflow: hidden;
    padding: 0 1.25rem;
  }

  .sandbox-left {
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
    border-right: 1px solid var(--border);
  }

  .panel-header {
    padding: 1rem 1.25rem 0.75rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .panel-header h2 {
    margin: 0 0 0.25rem;
    font-size: 0.9rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-primary);
  }

  .panel-subtitle {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .tab {
    flex: 1;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 0.6rem 0;
    font-size: 0.8rem;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    margin-bottom: -1px;
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .filter-bar {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 0.875rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .filter-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0.2rem 0.6rem;
    font-size: 0.72rem;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  .filter-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #000;
    font-weight: 600;
  }

  .list-scroll {
    overflow-y: auto;
    flex: 1;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .sandbox-right {
    overflow-y: auto;
    padding: 1rem 1.25rem 1rem 0.5rem;
  }

  .field-panel {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .field-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .field-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .field-personnel {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-family: monospace;
  }

  .tells-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .tells-toggle input { accent-color: var(--accent); }

  .formation-detail {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .formation-desc {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .sw-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 600px) {
    .sw-grid { grid-template-columns: 1fr; }
  }

  .section-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-bottom: 0.35rem;
  }

  .sw-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .sw-list li {
    font-size: 0.75rem;
    line-height: 1.4;
    padding-left: 1rem;
    position: relative;
    color: var(--text-secondary);
  }

  .strengths li::before {
    content: '+';
    position: absolute;
    left: 0;
    color: var(--off-accent);
    font-weight: 700;
  }

  .weaknesses li::before {
    content: '−';
    position: absolute;
    left: 0;
    color: #c0392b;
    font-weight: 700;
  }

  /* Positions tab */
  .pos-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 0.6rem 0.75rem;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    width: 100%;
    transition: background 0.1s;
  }

  .pos-row:hover { background: var(--surface-hover); }

  .pos-abbr-sm {
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 700;
    font-family: monospace;
    flex-shrink: 0;
  }

  .pos-abbr-sm.offense { background: #1a6e3c; border: 1px solid #2aaf60; color: #fff; }
  .pos-abbr-sm.defense { background: #1a3a6e; border: 1px solid #2a60af; color: #fff; }

  .pos-row-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .pos-row-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .pos-row-resp {
    font-size: 0.72rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Position detail */
  .pos-detail {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    overflow-y: auto;
    flex: 1;
    padding: 0.75rem;
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 0.78rem;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    text-align: left;
  }

  .pos-detail-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .pos-abbr {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 700;
    font-family: monospace;
    flex-shrink: 0;
  }

  .pos-abbr.offense { background: #1a6e3c; border: 2px solid #2aaf60; color: #fff; }
  .pos-abbr.defense { background: #1a3a6e; border: 2px solid #2a60af; color: #fff; }

  .pos-detail-header h3 {
    margin: 0 0 0.15rem;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .pos-side {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .pos-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .resp-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .resp-list li {
    font-size: 0.8rem;
    color: var(--text-secondary);
    padding-left: 0.875rem;
    position: relative;
    line-height: 1.5;
  }

  .resp-list li::before {
    content: '›';
    position: absolute;
    left: 0;
    color: var(--accent-muted);
  }

  .pos-notes {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.6;
    border-left: 2px solid var(--accent-muted);
    padding-left: 0.75rem;
  }

  .glossary-link {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.4rem 0.75rem;
    color: var(--accent);
    font-size: 0.75rem;
    cursor: pointer;
    font-family: inherit;
    align-self: flex-start;
    transition: background 0.1s;
  }

  .glossary-link:hover { background: var(--surface-raised); }

  .compact-formation {
    margin-bottom: 0.75rem;
  }

  .compact-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    letter-spacing: 0.06em;
    margin-bottom: 0.3rem;
    text-transform: uppercase;
  }

  .positions-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
    border-top: 1px solid var(--border);
    padding-top: 0.75rem;
  }
</style>
