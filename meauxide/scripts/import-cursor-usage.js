#!/usr/bin/env node
/**
 * Import Cursor usage CSV into MeauxIDE D1 (ai_usage_log).
 * Usage: node scripts/import-cursor-usage.js <path-to-csv> [baseUrl]
 * Example: node scripts/import-cursor-usage.js ~/Downloads/meauxbility@gmail-usage-events-2026-02-03.csv
 * Base URL defaults to https://meauxide.meauxbility.workers.dev
 * Account is derived from filename (e.g. meauxbility@gmail) or pass MEAUX_ACCOUNT=meauxbility@gmail.com
 */

const fs = require('fs');
const path = require('path');

const csvPath = process.argv[2];
const baseUrl = process.argv[3] || process.env.MEAUXIDE_URL || 'https://meauxide.meauxbility.workers.dev';
const account = process.env.MEAUX_ACCOUNT || (csvPath && path.basename(csvPath).replace(/-usage-events.*\.csv$/i, '').replace(/-/g, '.')) || 'meauxbility@gmail.com';

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('Usage: node import-cursor-usage.js <path-to-csv> [baseUrl]');
  console.error('Example: node import-cursor-usage.js ~/Downloads/meauxbility@gmail-usage-events-2026-02-03.csv');
  process.exit(1);
}

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);
const header = parseCSVLine(lines[0]);
const events = [];
for (let i = 1; i < lines.length; i++) {
  const vals = parseCSVLine(lines[i]);
  const row = {};
  header.forEach((h, j) => { row[h] = (vals[j] ?? '').replace(/^"|"$/g, ''); });
  events.push(row);
}

const payload = { account, provider: 'Cursor', events };
const url = baseUrl.replace(/\/$/, '') + '/api/analytics/neurons/import';

(async () => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      console.log(`Imported ${data.inserted} of ${data.total} events for ${data.account} (${data.provider}).`);
    } else {
      console.error('Import failed:', data.error || data);
      process.exit(1);
    }
  } catch (e) {
    console.error('Request failed:', e.message);
    process.exit(1);
  }
})();
