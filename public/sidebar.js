// sidebar.js - creates a modular collapsible sidebar and wires map controls
import { getDatasets, renderMap as renderMapRaw, getDefaultMapPath, focusFeature } from './map.js';

function createSidebarRoot() {
    const root = document.getElementById('sidebar-root');
    root.innerHTML = `
        <aside id="sidebar" class="sidebar">
            <button id="hideSidebarLegend" class="sidebar-hide">&#x25C0;</button>
            <div class="sidebar-section" data-section="datasets">
                <button class="section-toggle">Datasets <span class="caret">▾</span></button>
                <div class="section-body" id="datasetCheckboxes"></div>
            </div>
            <div class="sidebar-section" data-section="legend">
                <button class="section-toggle">Legend <span class="caret">▾</span></button>
                <div class="section-body"><ul id="legendList" class="legend-list"></ul></div>
            </div>
            <div class="sidebar-section" data-section="maps">
                <button class="section-toggle"> Maps <span class="caret">▾</span></button>
                <div class="section-body">
                    <div class="maps-selects">
                        <select id="topoSelect" size="8"></select>
                        <select id="countrySelect" size="8" aria-label="Countries"></select>
                    </div>
                    <div class="topo-controls">
                        <button id="loadTopoBtn">Load selected</button>
                        <small id="topoPath" class="topo-path"></small>
                    </div>
                </div>
            </div>
        </aside>
        <button id="showSidebarLegend" class="sidebar-show" aria-expanded="true">&#x25B6;</button>
    `;
    return root;
}

async function init() {
    createSidebarRoot();
    const datasets = await getDatasets();

    // Populate checkbox list
    const checkboxContainer = document.getElementById('datasetCheckboxes');
    checkboxContainer.innerHTML = '';
    datasets.forEach(ds => {
        const label = document.createElement('label');
        label.className = 'dataset-label';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = ds.key;
        checkbox.checked = false;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + ds.name));
        checkboxContainer.appendChild(label);
    });

    // topo list
    try {
        const topoListResp = await fetch('/topoList.json');
        if (topoListResp.ok) {
            const topoList = await topoListResp.json();
            const topoSelect = document.getElementById('topoSelect');
            topoSelect.innerHTML = '';
            topoList.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                // Display a cleaner name: remove the collection prefix and any trailing .topo.json
                let label = p.replace('/node_modules/@highcharts/map-collection/custom/', '');
                label = label.replace(/\.topo\.json$/i, '');
                opt.textContent = label;
                topoSelect.appendChild(opt);
            });
            const current = (new URLSearchParams(window.location.search)).get('map') || getDefaultMapPath();
            Array.from(topoSelect.options).forEach(o => { if (o.value === current) o.selected = true; });
            document.getElementById('topoPath').textContent = Array.from(topoSelect.selectedOptions).map(o=>o.value)[0] || '';
            document.getElementById('loadTopoBtn').onclick = () => {
                const sel = topoSelect.value;
                if (sel) {
                    window.__SELECTED_TOPO__ = sel;
                    document.getElementById('topoPath').textContent = sel;
                    updateAndRender();
                }
            };
            topoSelect.onchange = async () => {
                document.getElementById('topoPath').textContent = topoSelect.value;
                await populateCountriesForTopo(topoSelect.value);
            };
            // double-click to load a map immediately
            topoSelect.ondblclick = async () => {
                const sel = topoSelect.value;
                if (sel) {
                    window.__SELECTED_TOPO__ = sel;
                    document.getElementById('topoPath').textContent = sel;
                    await populateCountriesForTopo(sel);
                    updateAndRender();
                }
            };
        }
    } catch (e) {
        console.warn('Error loading topoList.json', e);
    }

    // Collapse toggles
    document.querySelectorAll('.section-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.parentElement;
            section.classList.toggle('collapsed');
            const caret = btn.querySelector('.caret');
            if (section.classList.contains('collapsed')) caret.textContent = '▸'; else caret.textContent = '▾';
        });
    });

    // Sidebar show/hide
    const sidebar = document.getElementById('sidebar');
    const hideBtn = document.getElementById('hideSidebarLegend');
    const showBtn = document.getElementById('showSidebarLegend');
    hideBtn.addEventListener('click', () => {
        sidebar.classList.add('hidden');
        showBtn.style.display = 'block';
        showBtn.setAttribute('aria-expanded', 'false');
    });
    showBtn.addEventListener('click', () => {
        sidebar.classList.remove('hidden');
        showBtn.style.display = 'none';
        showBtn.setAttribute('aria-expanded', 'true');
    });

    // Legend updater and map wiring
    let selectedKeys = [];
    function updateLegend() {
        const legendList = document.getElementById('legendList');
        legendList.innerHTML = '';
        datasets.filter(ds => selectedKeys.includes(ds.key)).forEach(ds => {
            const li = document.createElement('li');
            li.textContent = ds.name;
            li.style.color = ds.color || '';
            legendList.appendChild(li);
        });
    }

    async function updateAndRender() {
        selectedKeys = Array.from(checkboxContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        updateLegend();
        await renderMapRaw(selectedKeys, datasets);
    }

    // Populate countrySelect based on a topology file
    async function populateCountriesForTopo(topoPath) {
        const countrySelect = document.getElementById('countrySelect');
        countrySelect.innerHTML = '';
        if (!topoPath) return;
        try {
            const resp = await fetch(topoPath);
            if (!resp.ok) return;
            const topology = await resp.json();
            // try common places for features
            const geoms = topology.objects && (topology.objects.default || Object.values(topology.objects)[0]);
            const geometries = geoms && geoms.geometries;
            if (!geometries || !geometries.length) return;
            // Build options: display name (name or 'hc-key') and value = hc-key
            geometries.forEach(g => {
                const props = g.properties || {};
                const name = props.name || props.NAME || props['name_en'] || props['hc-key'] || props['iso_a2'] || '';
                const key = props['hc-key'] || props['hc_key'] || props.hc_key || name;
                const isoA2 = (props['iso-a2'] || props.iso_a2 || props.ISO_A2 || '').toString().trim();
                const isoA3 = (props['iso-a3'] || props.iso_a3 || props.ISO_A3 || '').toString().trim();
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = name || key;
                opt.title = key;
                if (isoA2) opt.dataset.isoA2 = isoA2;
                if (isoA3) opt.dataset.isoA3 = isoA3;
                countrySelect.appendChild(opt);
            });
        } catch (e) {
            console.warn('Could not populate countries for topo', e);
        }
    }

    const countrySelectEl = document.getElementById('countrySelect');
    // when a country is selected/double-clicked, try loading the dedicated country topo from node_modules
    async function tryLoadCountryTopoFromOption(opt) {
        if (!opt) return false;
        const isoA2 = opt.dataset.isoA2;
        const isoA3 = opt.dataset.isoA3;
        // Try common file patterns used by the map-collection package
        const candidates = [];
        if (isoA2) {
            candidates.push(`/node_modules/@highcharts/map-collection/countries/${isoA2}/${isoA2}-all.topo.json`);
            candidates.push(`/node_modules/@highcharts/map-collection/countries/${isoA2}/${isoA2}-all.geo.json`);
        }
        if (isoA3) {
            candidates.push(`/node_modules/@highcharts/map-collection/countries/${isoA3}/${isoA3}-all.topo.json`);
            candidates.push(`/node_modules/@highcharts/map-collection/countries/${isoA3}/${isoA3}-all.geo.json`);
        }
        // last-resort: try by option value name
        const nameKey = opt.value;
        if (nameKey) candidates.push(`/node_modules/@highcharts/map-collection/countries/${nameKey}/${nameKey}-all.topo.json`);

        for (const path of candidates) {
            try {
                const r = await fetch(path, { method: 'HEAD' });
                if (r && r.ok) {
                    window.__SELECTED_TOPO__ = path;
                    document.getElementById('topoPath').textContent = path;
                    await updateAndRender();
                    return true;
                }
            } catch (e) {
                // ignore and try next
            }
        }
        return false;
    }

    countrySelectEl.onchange = async () => {
        const idx = countrySelectEl.selectedIndex;
        if (idx < 0) return;
        const opt = countrySelectEl.options[idx];
        const loaded = await tryLoadCountryTopoFromOption(opt);
        if (!loaded) {
            // fallback to focusing via existing map data
            try { focusFeature(opt.value); } catch (e) { console.warn(e); }
        }
    };

    countrySelectEl.ondblclick = async () => {
        const idx = countrySelectEl.selectedIndex;
        if (idx < 0) return;
        const opt = countrySelectEl.options[idx];
        const loaded = await tryLoadCountryTopoFromOption(opt);
        if (!loaded) {
            try { focusFeature(opt.value); } catch (e) { console.warn(e); }
        }
    };

    checkboxContainer.addEventListener('change', updateAndRender);

    // initial render
    updateAndRender();
}

document.addEventListener('DOMContentLoaded', init);
