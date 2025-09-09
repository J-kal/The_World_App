// Modular data handler for datasets
// Loads and parses datasets from CSV
// List your datasets here
const datasetConfigs = [
    { key: 'population', name: 'Population', color: '#1f77b4', file: 'datasets/population.csv' },
    { key: 'gdp', name: 'GDP', color: '#ff7f0e', file: 'datasets/gdp.csv' }
    // Add more datasets here
];

export async function getDatasets() {
    const datasets = [];
    // Resolve PapaParse robustly: prefer a global (window/globalThis), then CommonJS require,
    // then dynamic ESM import. This covers browsers, bundlers, and Node.
    let Papa = (typeof globalThis !== 'undefined' && globalThis.Papa) ? globalThis.Papa : null;
    if (!Papa) {
        try {
            if (typeof require === 'function') {
                const pkg = require('papaparse');
                // pkg may be the module or an object with default
                Papa = pkg && (pkg.parse ? pkg : (pkg.default || pkg));
            }
        } catch (e) {
            // ignore require errors
        }
    }
    if (!Papa) {
        try {
            // dynamic import works in ESM environments; wrap in try/catch to avoid breaking
            const mod = await import('papaparse');
            Papa = mod && (mod.default || mod);
        } catch (e) {
            // ignore import errors
        }
    }

    for (const config of datasetConfigs) {
        const text = await fetch(config.file).then(r => r.text());
        let rows;
        if (Papa && typeof Papa.parse === 'function') {
            rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
        } else {
            // Fallback to simple parser
            const lines = text.trim().split('\n');
            const header = lines[0].split(',').map(h => h.trim());
            rows = lines.slice(1).map(line => {
                const cols = line.split(',').map(c => c.trim());
                const obj = {};
                header.forEach((h, i) => obj[h] = cols[i] || '');
                return obj;
            });
        }

        datasets.push({
            key: config.key,
            name: config.name,
            color: config.color,
            data: rows.map(row => {
                const raw = (row['hc-key'] || row['hc_key'] || row.hc_key || '').toString().trim();
                const valRaw = (row.value || row.Value || '').toString().trim();
                const cleaned = valRaw.replace(/,/g, '').replace(/[^0-9.\-eE+]/g, '');
                const num = cleaned === '' ? null : Number(cleaned);
                return { 'hc-key': raw, value: Number.isFinite(num) ? num : null };
            })
        });
    }
    return datasets;
}
