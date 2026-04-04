---
layout: null
permalink: /assets/js/tsver.js
---
/**
 * TSVer – dataset browser with Plotly charts + series metadata
 * Data files:
 *   - JSONL records:  {{ '/assets/data/tsver.jsonl' | absolute_url }}
 *   - Time series CSVs under: {{ '/assets/data/time_series/csv' | absolute_url }}/<Series>.csv
 *   - Country code mapping:   {{ '/assets/data/time_series/country_codes.yaml' | absolute_url }}
 *   - Series metadata:        {{ '/assets/data/time_series/metadata.json' | absolute_url }}
 */

const TS_BASE            = "{{ '/assets/data/time_series/csv' | relative_url }}";
const COUNTRY_CODES_URL  = "{{ '/assets/data/time_series/country_codes.yaml' | relative_url }}";
const SOURCES_META_URL   = "{{ '/assets/data/time_series/metadata.json' | relative_url }}";

// Dataset configuration
const DATASETS = {
  test: {
    url: "{{ '/assets/data/tsver_test.jsonl' | relative_url }}",
    name: "Test Set"
  },
  dev: {
    url: "{{ '/assets/data/tsver_dev.jsonl' | relative_url }}",
    name: "Dev Set"
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // ====== Country code map (code → name) ======
  let CODE_TO_NAME = {};
  async function loadCountryMap() {
    try {
      const res = await fetch(COUNTRY_CODES_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const yamlText = await res.text();

      // Simple YAML parser for the country code structure
      // Expected format: CODE:\n- Country Name\n
      const m = {};
      const lines = yamlText.split(/\r?\n/);
      let currentCode = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Lines ending with ':' are country codes
        if (line.match(/^[A-Z_]+:$/)) {
          currentCode = line.slice(0, -1); // remove ':'
        }
        // Lines starting with '- ' are country names
        else if (line.startsWith('- ') && currentCode) {
          const countryName = line.slice(2).trim();
          // Remove quotes if present
          const cleanName = countryName.replace(/^["']|["']$/g, '');
          m[currentCode] = cleanName;
          currentCode = null;
        }
      }

      // Add fallbacks for common codes
      if (!m.OWID_WRL) m.OWID_WRL = 'World';
      if (!m.OWID_KOS) m.OWID_KOS = 'Kosovo';
      CODE_TO_NAME = m;
    } catch (e) {
      console.warn('Country map load failed; showing codes:', e);
      CODE_TO_NAME = {};
    }
  }
  const nameFor = (code) => (CODE_TO_NAME[code] || code);

  // ====== Series metadata map (series key → details) ======
  // We key by the file's base name without ".csv", e.g. "annual-co2-emissions-per-country"
  let SERIES_META = {};
  async function loadSourcesMeta() {
    try {
      const res = await fetch(SOURCES_META_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const map = {};
      if (Array.isArray(data)) {
        data.forEach(entry => {
          const fn = (entry && entry.filename) ? String(entry.filename) : '';
          if (!fn) return;
          const key = fn.endsWith('.csv') ? fn.slice(0, -4) : fn;

          // Check if this is the new format (title, description, unit at top level)
          if (entry.title || entry.description || entry.unit) {
            // New format: normalize to match expected structure
            map[key] = {
              filename: fn,
              details: {
                title: entry.title || '',
                description: entry.description || '',
                unit: entry.unit || ''
              }
            };
          } else {
            // Old format: has nested details object
            map[key] = entry; // store whole entry; we'll read entry.details.*
          }
        });
      } else if (data && typeof data === 'object') {
        // Direct object mapping filename -> metadata
        Object.entries(data).forEach(([filename, metadata]) => {
          const key = filename.endsWith('.csv') ? filename.slice(0, -4) : filename;
          map[key] = {
            filename: filename,
            details: metadata // assume metadata contains title, description, unit directly
          };
        });
      }
      SERIES_META = map;
    } catch (e) {
      console.warn('metadata.json load failed; proceeding without extra details:', e);
      SERIES_META = {};
    }
  }

  // ====== DOM helpers ======
  const $ = (id) => document.getElementById(id);
  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v);
    });
    children.forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  }

  function getIndexFromURL() {
    const u = new URL(window.location.href);
    const i = parseInt(u.searchParams.get('i'), 10);
    return Number.isFinite(i) && i >= 0 ? i : 0;
  }
  function getDatasetFromURL() {
    const u = new URL(window.location.href);
    const d = u.searchParams.get('d');
    return (d && DATASETS[d]) ? d : 'test'; // default to test set
  }
  function setURLParams(i, dataset, replace = false) {
    const u = new URL(window.location.href);
    u.searchParams.set('i', i);
    u.searchParams.set('d', dataset);
    if (replace) history.replaceState({ i, dataset }, '', u);
    else history.pushState({ i, dataset }, '', u);
  }
  const sanitize = (str) => (str === null || str === undefined) ? '' : String(str);

  // ====== Loaders ======
  async function loadJSONL(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status} ${res.statusText}`);
    const text = await res.text();
    return text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length && !l.startsWith('//'))
      .map((l, lineNo) => { try { return JSON.parse(l); } catch (e) { console.warn('Bad JSON line', lineNo + 1, e); return null; } })
      .filter(Boolean);
  }

  function parseCSV(text) {
    // Simple CSV parser (assumes no embedded commas in quoted fields)
    const lines = text.split(/\r?\n/).filter(l => l.length);
    if (!lines.length) return { header: [], rows: [] };
    const header = lines[0].split(',');
    const rows = lines.slice(1).map(line => line.split(','));
    return { header, rows };
  }

  async function fetchCSVFor(seriesName) {
    // Direct lookup in flat directory structure
    const url = `${TS_BASE}/${encodeURIComponent(seriesName)}.csv`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return { url, text: await res.text() };
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      throw new Error(`CSV not found for "${seriesName}": ${err.message}`);
    }
  }

  // ====== Plotting helpers ======
  function buildCountryPicker(allNames, onChange, initialSelection) {
    const wrapper = el('div', { class: 'tsver-picker' });
    const select = el('select', { multiple: 'multiple', size: Math.min(7, Math.max(4, allNames.length)) });
    allNames.forEach(n => {
      const opt = el('option', { value: n });
      opt.textContent = n;
      if (initialSelection && initialSelection.has(n)) opt.selected = true;
      select.appendChild(opt);
    });
    const help = el('div', { class: 'tsver-picker-help' }, 'Hold Ctrl/Cmd to select multiple countries');
    select.addEventListener('change', () => {
      const chosen = new Set(Array.from(select.selectedOptions).map(o => o.value));
      onChange(chosen);
    });
    wrapper.appendChild(select);
    wrapper.appendChild(help);
    return { root: wrapper, select };
  }

  function chooseDefaultCountries(cols, rows, max = 4) {
    const scored = cols.map(c => {
      let nonEmpty = 0;
      for (const r of rows) {
        const v = r[c.colIndex];
        if (v !== undefined && v !== '' && v !== null) nonEmpty++;
      }
      return { ...c, nonEmpty };
    });
    return new Set(scored.sort((a, b) => b.nonEmpty - a.nonEmpty).slice(0, max).map(c => c.name));
  }

  const toNumeric = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // ====== Series rendering ======
  async function renderOneSeries(container, seriesName, rangeMeta) {
    const meta = SERIES_META[seriesName]; // by base name (without .csv)
    const card = el('div', { class: 'tsver-series-card' });

    // Title: prefer meta.details.title, else seriesName
    const displayTitle = meta?.details?.title || seriesName;
    card.appendChild(el('h4', {}, displayTitle));

    const status = el('div', { class: 'tsver-series-status', style: 'opacity:.75' }, 'Loading…');
    card.appendChild(status);
    container.appendChild(card);

    try {
      const { url, text } = await fetchCSVFor(seriesName);
      status.textContent = 'Parsing…';
      const { header, rows } = parseCSV(text);
      if (!header.length || header[0] !== 'Date') throw new Error('CSV must have "Date" as first column');

      const years = rows.map(r => Number(r[0])).filter(Number.isFinite);

      // Build array of columns: {code, name, colIndex}
      const cols = header.slice(1).map((code, idx) => ({
        code,
        name: nameFor(code),
        colIndex: idx + 1
      }));

      // Ensure unique names (rare collisions)
      (function ensureUniqueNames(list) {
        const used = new Map();
        list.forEach(c => {
          const base = c.name;
          let n = base, k = 1;
          while (used.has(n)) { k++; n = `${base} [${k}]`; }
          used.set(n, true);
          c.name = n;
        });
      })(cols);

      // Defaults and alphabetized picker list
      const defaultNames = chooseDefaultCountries(cols, rows, 4);
      const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
      const allNames = cols.map(c => c.name).sort(collator.compare);

      const plotDiv = el('div', { class: 'tsver-plot', style: 'width:100%;height:420px' });
      const picker = buildCountryPicker(allNames, (chosen) => draw(chosen), defaultNames);

      const shapes = [];
      if (Array.isArray(rangeMeta)) {
        rangeMeta.forEach(r => {
          const from = Number(r.from), to = Number(r.to);
          if (Number.isFinite(from) && Number.isFinite(to)) {
            shapes.push({
              type: 'rect',
              xref: 'x', yref: 'paper',
              x0: from, x1: to,
              y0: 0, y1: 1,
              fillcolor: 'rgba(200,200,200,0.2)',
              line: { width: 0 }
            });
          }
        });
      }

      function draw(chosenNameSet) {
        const chosen = chosenNameSet && chosenNameSet.size ? chosenNameSet : defaultNames;
        const traces = [];

        cols.forEach(c => {
          if (!chosen.has(c.name)) return;
          const ys = rows.map(r => toNumeric(r[c.colIndex]));
          if (ys.every(v => v === null)) return;

          traces.push({
            x: years,
            y: ys,
            name: c.name,
            mode: 'lines',
            connectgaps: false,
            hovertemplate: '%{x}: %{y}<extra>' + c.name + ' (' + c.code + ')</extra>'
          });
        });

        const yLabel = meta?.details?.unit || ''; // unit (if provided)
        const layout = {
          margin: { l: 50, r: 15, t: 10, b: 40 },
          xaxis: { title: 'Year', tickmode: 'auto' },
          yaxis: { title: yLabel, rangemode: 'tozero' },
          legend: { orientation: 'h', y: -0.2 },
          shapes
        };

        Plotly.newPlot(plotDiv, traces, layout, { displayModeBar: true, responsive: true });
      }

      const controls = el('div', { class: 'tsver-series-controls' });
      controls.appendChild(picker.root);
      card.appendChild(controls);
      card.appendChild(plotDiv);

      console.warn(meta.details);

      // Description + Unit (from metadata.json)
      if (meta?.details?.description || meta?.details?.unit) {
        const descWrap = el('div', { class: 'tsver-series-desc', style: 'margin:.35rem 0 .25rem 0; opacity:.9' });
        if (meta.details.description) {
          // description may contain <br>, so use innerHTML
          descWrap.innerHTML = meta.details.description;
        }
        if (meta.details.unit) {
          descWrap.appendChild(el('div', { class: 'tsver-series-unit', style: 'opacity:.75; margin-top:.25rem' }, `Unit: ${meta.details.unit}`));
        }
        card.appendChild(descWrap);
      }

      // Link to CSV + year span
      card.appendChild(el('div', { class: 'tsver-series-meta' },
        el('a', { href: url, target: '_blank', rel: 'noopener' }, 'Open CSV'),
        el('span', { style: 'margin-left:0.75rem; opacity:.75' }, ` | Years ${Math.min(...years)}–${Math.max(...years)}`)
      ));

      status.remove();
      draw(defaultNames);
    } catch (err) {
      status.textContent = 'Could not load this series: ' + (err && err.message ? err.message : err);
      status.style.color = 'var(--tsver-error, #b00020)';
    }
  }

  async function renderAllSeries(rec) {
    const holder = $('tsver-tseries');
    if (!holder) return;
    holder.innerHTML = '';
    const tr = rec.TimeSeries && typeof rec.TimeSeries === 'object' ? rec.TimeSeries : {};
    const keys = Object.keys(tr);
    if (!keys.length) {
      holder.appendChild(el('div', { style: 'opacity:.75' }, 'No time series listed for this item.'));
      return;
    }
    for (const key of keys) {
      // key is the base filename without .csv (e.g., "annual-co2-emissions-per-country")
      await renderOneSeries(holder, key, tr[key]);
    }
  }

  // ====== Dataset navigation & rendering ======
  let items = [];
  let index = 0;
  let currentDataset = 'test';

  async function switchDataset(newDataset) {
    if (!DATASETS[newDataset] || newDataset === currentDataset) return;

    const status = $('tsver-status');
    const card = $('tsver-card');
    const nav = $('tsver-nav');

    // Show loading state
    if (card) card.style.display = 'none';
    if (nav) nav.style.display = 'none';
    if (status) {
      status.style.display = 'block';
      status.textContent = `Loading ${DATASETS[newDataset].name}...`;
    }

    try {
      currentDataset = newDataset;
      items = await loadJSONL(DATASETS[newDataset].url);
      if (!items.length) throw new Error(`No items in ${DATASETS[newDataset].name}.`);

      // Reset to first item of new dataset
      index = 0;
      if (status) status.style.display = 'none';
      render(0);
    } catch (err) {
      if (status) status.textContent = `Could not load ${DATASETS[newDataset].name}. ` + (err && err.message ? err.message : '');
      console.error(err);
    }
  }

  function attachEvents() {
    const prev = $('tsver-prev');
    const next = $('tsver-next');
    const testLink = $('tsver-test-link');
    const devLink = $('tsver-dev-link');

    if (prev) prev.addEventListener('click', () => render(index - 1));
    if (next) next.addEventListener('click', () => render(index + 1));

    if (testLink) {
      testLink.addEventListener('click', () => {
        switchDataset('test');
      });
    }

    if (devLink) {
      devLink.addEventListener('click', () => {
        switchDataset('dev');
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); if (index > 0) render(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); if (index < items.length - 1) render(index + 1); }
    });

    window.addEventListener('popstate', (ev) => {
      const i = ev.state && Number.isFinite(ev.state.i) ? ev.state.i : getIndexFromURL();
      const d = ev.state && ev.state.dataset ? ev.state.dataset : getDatasetFromURL();
      if (d !== currentDataset) {
        switchDataset(d).then(() => render(i));
      } else {
        render(i);
      }
    });
  }

  function render(i) {
    if (!items.length) return;
    i = Math.max(0, Math.min(i, items.length - 1));
    index = i;
    const rec = items[i] || {};

    const claimEl = $('tsver-claim');
    const dateEl = $('tsver-date');
    const claimantEl = $('tsver-claimant');
    const publisherEl = $('tsver-publisher');
    const urlEl = $('tsver-url');
    const explList = $('tsver-justifications');
    const verdictEl = $('tsver-verdict');

    if (claimEl) claimEl.textContent = sanitize(rec.Claim);
    if (dateEl) dateEl.textContent = sanitize(rec.Date);
    if (claimantEl) claimantEl.textContent = sanitize(rec.Claimant);
    if (publisherEl) publisherEl.textContent = sanitize(rec.Publisher);

    if (urlEl) {
      const url = sanitize(rec.URL);
      urlEl.textContent = url;
      urlEl.href = url || '#';
    }

    if (explList) {
      explList.innerHTML = '';
      (Array.isArray(rec.Justifications) ? rec.Justifications : []).forEach(ex => {
        const li = document.createElement('li');
        li.textContent = ex;
        explList.appendChild(li);
      });
    }

    if (verdictEl) verdictEl.textContent = sanitize(rec.Verdict);

    const tsHolder = $('tsver-tseries');
    if (tsHolder) {
      tsHolder.innerHTML = '<div id="tsver-tseries-status" style="opacity:.8">Looking for time series…</div>';
      renderAllSeries(rec);
    }

    const prev = $('tsver-prev');
    const next = $('tsver-next');
    const counter = $('tsver-counter');
    const testLink = $('tsver-test-link');
    const devLink = $('tsver-dev-link');

    if (prev) prev.disabled = (i === 0);
    if (next) next.disabled = (i >= items.length - 1);
    if (counter) counter.textContent = `${i + 1} / ${items.length}`;

    // Update dataset link styling
    if (testLink) {
      testLink.className = currentDataset === 'test' ? 'active' : '';
    }
    if (devLink) {
      devLink.className = currentDataset === 'dev' ? 'active' : '';
    }

    const card = $('tsver-card');
    const nav = $('tsver-nav');
    if (card) card.style.display = '';
    if (nav) nav.style.display = 'flex';

    setURLParams(i, currentDataset, /*replace=*/true);
  }

  // ====== Init ======
  (async function init() {
    const status = $('tsver-status');

    try {
      await Promise.all([loadCountryMap(), loadSourcesMeta()]);

      // Get initial dataset from URL or default to test
      const initialDataset = getDatasetFromURL();
      currentDataset = initialDataset;

      items = await loadJSONL(DATASETS[initialDataset].url);
      if (!items.length) throw new Error(`No items in ${DATASETS[initialDataset].name}.`);
      if (status) status.style.display = 'none';
      attachEvents();
      render(getIndexFromURL());
    } catch (err) {
      if (status) status.textContent = 'Could not load dataset. ' + (err && err.message ? err.message : '');
      console.error(err);
    }
  })();
});
