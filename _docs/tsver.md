---
layout: archive
title: "TSVer Explorer"
permalink: /
author_profile: false
classes: [wide, tsver-page]
---



<div id="tsver" class="tsver">
  <div id="tsver-status" aria-live="polite">Loading dataset…</div>

  <article id="tsver-card" style="display:none">

    <dl>
      <dt>Claim</dt>
      <dd id="tsver-claim"></dd>

      <dt>Date</dt>
      <dd id="tsver-date"></dd>

      <dt>Claimant</dt>
      <dd id="tsver-claimant"></dd>

      <dt>Publisher</dt>
      <dd id="tsver-publisher"></dd>

      <dt>URL</dt>
      <dd><a id="tsver-url" href="#" rel="noopener" target="_blank"></a></dd>

      <!-- Time series will be injected here -->
      <dt>Time series</dt>
      <dd id="tsver-tseries">
        <div id="tsver-tseries-status" style="opacity:.8">Looking for time series…</div>
      </dd>

      <dt>Justifications</dt>
      <dd><ol id="tsver-justifications"></ol></dd>

      <dt>Verdict</dt>
      <dd id="tsver-verdict" style="font-weight:600"></dd>
    </dl>
  </article>

  <nav id="tsver-nav" style="display:none; margin-top:1.5rem; display:flex; justify-content:space-between; align-items:center; gap:1rem;">
    <button id="tsver-prev" type="button" aria-label="Previous item">← Previous</button>
    <div id="tsver-counter" style="opacity:.7"></div>
    <button id="tsver-next" type="button" aria-label="Next item">Next →</button>
  </nav>
</div>


<!-- Plotly (no styling needed) -->
<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>

<!-- Include your own JS -->
<script src="{{ '/assets/js/tsver.js' | relative_url }}"></script>


<style>
#tsver dl { display: grid; grid-template-columns: max-content 1fr; gap: .25rem .75rem; }
#tsver dt { font-weight: 600; }
#tsver dd { margin: 0 0 .75rem 0; }
#tsver button[disabled] { opacity: .4; cursor: not-allowed; }
#tsver a { word-break: break-all; }

.tsver-series-card {
  border: 1px solid #e5e7eb;
  border-radius: .75rem;
  padding: .75rem .9rem;
  margin: .75rem 0;
  background: #fafafa;
}
.tsver-series-card h4 { margin: .25rem 0 .5rem 0; }
.tsver-series-controls { margin: .25rem 0 .5rem 0; display:flex; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
.tsver-picker select { min-width: 220px; }
.tsver-picker-help { font-size: .85em; opacity: .7; margin-top:.25rem; }
@media (prefers-color-scheme: dark) {
  .tsver-series-card { background: #111418; border-color: #2a2f36; }
}
</style>
