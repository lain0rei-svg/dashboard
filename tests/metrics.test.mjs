import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { returns, windowRows } from '../site/metrics.mjs';

const row = (date, nav, daily) => ({date, nav, daily});

test('week and month use actual dated closing prices across weekends', () => {
  const history = [row('2025-08-29', 10), row('2025-09-05', 11), row('2025-09-08', 12, .42)];
  const [daily, weekly, monthly] = returns(history);
  assert.equal(daily, .42);
  assert.ok(Math.abs(weekly - 100/11) < 1e-9);
  assert.ok(Math.abs(monthly - 20) < 1e-9);
});

test('absent baseline or daily change remains unavailable', () => {
  assert.deepEqual(returns([]), [null,null,null]);
  assert.deepEqual(returns([row('2025-09-04', 11), row('2025-09-08', 12)]), [null,null,null]);
});

test('chart windows use the last valuation, including leap-year boundaries', () => {
  const history = [row('2023-02-27', 10), row('2023-02-28', 11), row('2024-02-29', 12)];
  assert.equal(windowRows(history, '30').length, 1);
  assert.equal(windowRows(history, 'year').length, 2);
  assert.equal(windowRows(history, 'all').length, 3);
});

test('all eight products are present and evidence records are dated and sorted', () => {
  const products = JSON.parse(readFileSync(new URL('../site/data.json', import.meta.url)));
  assert.equal(products.length, 8);
  assert.equal(new Set(products.map(p => p.id)).size, 8);
  assert.equal(products.filter(p => p.match).length, 3);
  for (const p of products) {
    const dates = p.history.map(r => r.date);
    assert.deepEqual(dates, [...new Set(dates)].sort());
    assert.ok(p.history.every(r => Number(r.nav) > 0 && r.source.startsWith('https://') && r.retrievedAt));
  }
});
