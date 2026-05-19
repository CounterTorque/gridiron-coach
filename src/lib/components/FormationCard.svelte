<script>
  export let formation;
  export let selected = false;
  export let onClick = () => {};
</script>

<button
  class="card"
  class:selected
  class:offense={formation.side === 'offense'}
  class:defense={formation.side === 'defense'}
  onclick={onClick}
  aria-pressed={selected}
>
  <div class="card-header">
    <span class="card-name">{formation.name}</span>
    <span class="card-personnel">{formation.personnelLabel}</span>
  </div>
  <p class="card-desc">{formation.description}</p>
  <div class="card-tags">
    {#each formation.strengths.slice(0,2) as s}
      <span class="tag tag-strength">+</span><span class="tag-text">{s}</span>
    {/each}
  </div>
</button>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.875rem 1rem;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    font-family: inherit;
    width: 100%;
  }

  .card:hover {
    border-color: var(--border-hover);
    background: var(--surface-hover);
  }

  .card.selected.offense {
    border-color: var(--off-accent);
    background: rgba(42,175,96,0.08);
  }

  .card.selected.defense {
    border-color: var(--def-accent);
    background: rgba(42,96,175,0.08);
  }

  .card-header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .card-name {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .card-personnel {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: monospace;
  }

  .card-desc {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
  }

  .tag {
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--accent-muted);
    margin-right: 0.15rem;
  }

  .tag-text {
    font-size: 0.68rem;
    color: var(--text-muted);
    margin-right: 0.5rem;
  }
</style>
