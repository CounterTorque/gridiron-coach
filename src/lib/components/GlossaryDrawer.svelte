<script>
  import { glossaryOpen, glossaryTerm, glossarySearch } from '../stores/ui.js';
  import glossaryData from '../../data/glossary.json';

  let searchVal = '';
  $: glossarySearch.set(searchVal);

  $: filtered = searchVal.trim()
    ? glossaryData.filter(g =>
        g.term.toLowerCase().includes(searchVal.toLowerCase()) ||
        g.definition.toLowerCase().includes(searchVal.toLowerCase())
      )
    : glossaryData;

  function openTerm(term) {
    glossaryTerm.set(term);
  }

  function close() {
    glossaryOpen.set(false);
    glossaryTerm.set(null);
  }

  $: activeTerm = $glossaryTerm
    ? glossaryData.find(g => g.term === $glossaryTerm)
    : null;
</script>

{#if $glossaryOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" onclick={close}></div>
  <aside class="drawer">
    <div class="drawer-header">
      <h2>Glossary</h2>
      <button class="close-btn" onclick={close} aria-label="Close glossary">✕</button>
    </div>

    {#if activeTerm}
      <div class="term-detail">
        <button class="back-btn" onclick={() => glossaryTerm.set(null)}>← Back</button>
        <h3>{activeTerm.term}</h3>
        <p>{activeTerm.definition}</p>
        {#if activeTerm.related && activeTerm.related.length}
          <div class="related-terms">
            <span class="related-label">See also:</span>
            {#each activeTerm.related as rel}
              {#if glossaryData.find(g => g.term === rel)}
                <button class="related-link" onclick={() => openTerm(rel)}>{rel}</button>
              {:else}
                <span class="related-plain">{rel}</span>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="search-wrapper">
        <input
          type="text"
          placeholder="Search terms…"
          bind:value={searchVal}
          class="search-input"
          aria-label="Search glossary"
        />
      </div>
      <ul class="term-list">
        {#each filtered as entry}
          <li>
            <button class="term-btn" onclick={() => openTerm(entry.term)}>
              <span class="term-name">{entry.term}</span>
              <span class="term-preview">{entry.definition.slice(0, 72)}…</span>
            </button>
          </li>
        {/each}
        {#if filtered.length === 0}
          <li class="no-results">No matching terms.</li>
        {/if}
      </ul>
    {/if}
  </aside>
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(13,35,71,0.22);
    z-index: 100;
  }

  .drawer {
    position: absolute;
    top: 0;
    right: 0;
    width: min(400px, 95%);
    height: 100%;
    background: var(--bg);
    border-left: none;
    box-shadow: -8px 0 28px rgba(0,0,0,0.14), -1px 0 0 var(--shadow-light);
    z-index: 101;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .drawer-header h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    line-height: 1;
  }

  .close-btn:hover { color: var(--text-primary); }

  .search-wrapper {
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    background: var(--bg);
    border: none;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    color: var(--text-primary);
    font-size: 0.875rem;
    font-family: inherit;
    box-sizing: border-box;
    box-shadow: var(--neu-inset-sm);
  }

  .search-input::placeholder { color: var(--text-muted); }
  .search-input:focus {
    outline: none;
    box-shadow: var(--neu-inset);
  }

  .term-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
  }

  .term-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    width: 100%;
    background: var(--bg);
    border: none;
    border-bottom: 1px solid var(--border);
    padding: 0.75rem 1.25rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s;
  }

  .term-btn:hover { background: var(--surface-hover); }

  .term-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--accent);
  }

  .term-preview {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .no-results {
    padding: 1.5rem 1.25rem;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .term-detail {
    padding: 1.25rem;
    overflow-y: auto;
    flex: 1;
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 0.8rem;
    cursor: pointer;
    padding: 0;
    margin-bottom: 0.75rem;
    font-family: inherit;
  }

  .term-detail h3 {
    margin: 0 0 0.75rem;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .term-detail p {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .related-terms {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    margin-top: 0.5rem;
  }

  .related-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .related-link {
    background: var(--bg);
    border: none;
    border-radius: 5px;
    color: var(--accent);
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
    font-family: inherit;
    box-shadow: var(--neu-raised-sm);
    transition: box-shadow 0.15s;
  }

  .related-link:hover { box-shadow: var(--neu-raised); }

  .related-plain {
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.2rem 0.5rem;
  }
</style>
