<script>
  import { glossaryOpen, glossaryTerm } from '../stores/ui.js';
  import glossaryData from '../../data/glossary.json';

  export let text = '';
  export let clazz = '';

  // Build regex from all glossary terms — longest first to prefer multi-word matches
  const sortedTerms = [...glossaryData]
    .sort((a, b) => b.term.length - a.term.length)
    .map(g => g.term);

  const escaped = sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

  function tokenize(str) {
    if (!str) return [];
    const parts = [];
    let lastIdx = 0;
    const re = new RegExp(pattern.source, 'gi');
    let match;
    while ((match = re.exec(str)) !== null) {
      if (match.index > lastIdx) {
        parts.push({ type: 'text', text: str.slice(lastIdx, match.index) });
      }
      const matched = match[0];
      const entry = glossaryData.find(g => g.term.toLowerCase() === matched.toLowerCase());
      parts.push({ type: 'term', text: matched, term: entry?.term ?? matched });
      lastIdx = match.index + matched.length;
    }
    if (lastIdx < str.length) parts.push({ type: 'text', text: str.slice(lastIdx) });
    return parts;
  }

  $: segments = tokenize(text);

  function open(term) {
    glossaryTerm.set(term);
    glossaryOpen.set(true);
  }
</script>

<span class={clazz}>{#each segments as seg}{#if seg.type === 'term'}<button class="gl-link" onclick={() => open(seg.term)}>{seg.text}</button>{:else}{seg.text}{/if}{/each}</span>

<style>
  .gl-link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: var(--accent);
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
    cursor: pointer;
    line-height: inherit;
  }

  .gl-link:hover {
    color: var(--text-primary);
    text-decoration-style: solid;
  }
</style>
