// map.js - exports helpers for datasets and map rendering
import { getDatasets as fetchDatasets } from './dataHandler.js';

export async function getDatasets() {
    return await fetchDatasets();
}

export function getDefaultMapPath() {
    if (typeof window !== 'undefined' && window.REGION_MAP_PATH) return window.REGION_MAP_PATH;
    if (typeof window !== 'undefined' && window.__SELECTED_TOPO__) return window.__SELECTED_TOPO__;
    try {
        const p = (new URLSearchParams(window.location.search)).get('map');
        if (p) return p;
    } catch (e) {
        // ignore
    }
    return '/node_modules/@highcharts/map-collection/custom/world.topo.json';
}

let chart;
let lastTopology = null;

export async function renderMap(selectedKeys = [], datasets = null) {
    const mapPath = getDefaultMapPath();
    try {
        const resp = await fetch(mapPath);
        if (!resp.ok) throw new Error('Failed to load map data ' + resp.status);
        const topology = await resp.json();

        const features = topology.objects && topology.objects.default && topology.objects.default.geometries;
        if (!features) console.warn('Topology features not found', topology);

        if (!datasets) datasets = await getDatasets();

        const topologyKeys = new Set((features || []).map(f => f.properties && f.properties['hc-key']));
        datasets.forEach(ds => {
            const total = ds.data.length;
            const matched = ds.data.filter(d => topologyKeys.has(d['hc-key'])).length;
            console.log(`Dataset ${ds.key}: total=${total}, matched=${matched}`);
        });

        const primaryKey = selectedKeys.length ? selectedKeys[0] : (datasets[0] && datasets[0].key);
        const primaryDs = datasets.find(d => d.key === primaryKey) || datasets[0] || { data: [], name: '' };

        const values = primaryDs.data.map(d => Number(d && d.value)).filter(v => Number.isFinite(v));
        const maxVal = values.length ? Math.max(...values) : 0;

        const baseSeries = {
            mapData: topology,
            name: 'Base map',
            allAreas: true,
            showInLegend: false,
            enableMouseTracking: false,
            borderColor: '#c8c8c8',
            nullColor: '#f2f2f2'
        };
        const dataSeries = {
            mapData: topology,
            data: primaryDs.data,
            joinBy: ['hc-key', 'hc-key'],
            name: primaryDs.name,
            states: { hover: { color: '#a4edba' } },
            dataLabels: {
                enabled: true,
                formatter: function() {
                    return (this.point.value && this.point.value > 0) ? this.point.name : null;
                }
            }
        };
        const series = [baseSeries, dataSeries];

        if (chart) chart.destroy();
        chart = Highcharts.mapChart('container', {
            chart: { map: topology, backgroundColor: 'transparent', borderWidth: 0 },
            title: { text: null },
            subtitle: { text: null },
            mapNavigation: { enabled: true, buttonOptions: { verticalAlign: 'bottom' } },
            colorAxis: {
                min: 0,
                max: maxVal || undefined,
                nullColor: '#f2f2f2',
                stops: [ [0, '#f7fbff'], [0.5, '#6baed6'], [1, '#08306b'] ],
                labels: { formatter: function() { return Highcharts.numberFormat(this.value, 0); } }
            },
            series,
            tooltip: {
                shared: true,
                formatter: function() {
                    if (!selectedKeys.length) return false;
                    const nf = new Intl.NumberFormat();
                    let s = `<b>${this.point.name}</b><br/>`;
                    datasets.filter(ds => selectedKeys.includes(ds.key)).forEach(ds => {
                        const valObj = ds.data.find(d => d['hc-key'] === this.point['hc-key']);
                        if (valObj && valObj.value != null) {
                            s += `${ds.name}: <span style=\"color:${ds.color}\">${nf.format(valObj.value)}</span><br/>`;
                        }
                    });
                    return s;
                }
            }
        });

        console.log('Chart series count:', chart.series.length);
        chart.series.forEach(s => console.log(`Series ${s.name} points:`, s.data && s.data.length));

    } catch (e) {
        console.error('renderMap error', e);
    }
}

// Try to focus/zoom/select a feature by its `hc-key` on the currently rendered chart.
export function focusFeature(hcKey) {
    if (!chart) return;
    try {
        // Find a point matching the hc-key across all series
        let point = null;
        for (const s of chart.series) {
            if (!s.data) continue;
            point = s.data.find(p => {
                const pkey = (p && (p['hc-key'] || (p.options && p.options['hc-key']) || (p.properties && p.properties['hc-key'])));
                return pkey === hcKey;
            });
            if (point) break;
        }
        if (!point) {
            console.warn('focusFeature: point not found for', hcKey);
            return;
        }

        // Try point.zoomTo (supported by newer Highmaps), then try chart.mapView.fitToBounds using point.bounds,
        // then fall back to selecting/highlighting the point.
        if (typeof point.zoomTo === 'function') {
            try { point.zoomTo(); } catch (e) { console.warn('point.zoomTo failed', e); }
        } else if (chart.mapView && point.bounds && typeof chart.mapView.fitToBounds === 'function') {
            try { chart.mapView.fitToBounds(point.bounds); } catch (e) { console.warn('mapView.fitToBounds failed', e); }
        }

        // Try to highlight/select the point so it's visually obvious
        try {
            if (typeof point.select === 'function') point.select(true, false);
            if (typeof point.setState === 'function') point.setState('hover');
        } catch (e) {
            // non-fatal
        }
    } catch (e) {
        console.warn('focusFeature error', e);
    }
}
