#!/usr/bin/env node
/**
 * Read Cursor usage CSV and generate D1 seed SQL (INSERT into ai_usage_log).
 * Usage: node scripts/generate-cursor-seed.js <path-to-csv> [account]
 * Output: scripts/seed-cursor-meauxbility.sql
 */

const fs = require('fs');
const path = require('path');

const csvPath = process.argv[2];
const account = process.argv[3] || 'meauxbility@gmail.com';

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('Usage: node generate-cursor-seed.js <path-to-csv> [account]');
  process.exit(1);
}

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);
const header = parseCSVLine(lines[0]);
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const vals = parseCSVLine(lines[i]);
  const row = {};
  header.forEach((h, j) => { row[h] = (vals[j] ?? '').replace(/^"|"$/g, ''); });
  rows.push(row);
}

const out = [];
out.push('-- Cursor usage seed for ' + account + ' (generated from CSV)');
out.push('');

for (let i = 0; i < rows.length; i++) {
  const e = rows[i];
  const dateStr = (e.Date || '').slice(0, 10);
  if (!dateStr) continue;
  const totalTokens = parseInt(e['Total Tokens'] || '0', 10) || 0;
  const outputTokens = parseInt(e['Output Tokens'] || '0', 10) || 0;
  const tokensInput = Math.max(0, totalTokens - outputTokens);
  const cost = parseFloat(e.Cost || '0') || 0;
  const model = esc(e.Model || 'auto');
  const id = 'cursor-meaux-' + i + '-' + Date.now().toString(36);
  out.push(
    "INSERT INTO ai_usage_log (id, date, provider, model, tokens_input, tokens_output, cost_estimate, endpoint, account, created_at) VALUES (" +
    "'" + id + "', '" + dateStr + "', 'Cursor', '" + model + "', " + tokensInput + ", " + outputTokens + ", " + cost + ", 'import', '" + esc(account) + "', unixepoch());"
  );
}

const outPath = path.join(__dirname, 'seed-cursor-meauxbility.sql');
fs.writeFileSync(outPath, out.join('\n'), 'utf8');
console.log('Wrote ' + out.length + ' lines to ' + outPath + ' (' + (out.length - 2) + ' INSERTs).');
