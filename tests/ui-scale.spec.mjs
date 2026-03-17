import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

const modulePath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../lib/ui-scale.js'
);
const moduleSource = fs.readFileSync(modulePath, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource, 'utf8').toString('base64')}`;
const mod = await import(moduleUrl);

const {
  UI_SCALE_DEFAULT,
  UI_SCALE_PRESETS,
  normalizeUiScale,
  getUiScalePresetId,
  resolveUiScalePresetValue,
  toUiScaleFactor
} = mod;

test('normalizes ui scale bounds and fallback', async () => {
  expect(normalizeUiScale(50)).toBe(85);
  expect(normalizeUiScale(999)).toBe(140);
  expect(normalizeUiScale('invalid')).toBe(UI_SCALE_DEFAULT);
});

test('maps exact scale values to presets', async () => {
  expect(getUiScalePresetId(UI_SCALE_PRESETS.compact)).toBe('compact');
  expect(getUiScalePresetId(UI_SCALE_PRESETS.standard)).toBe('standard');
  expect(getUiScalePresetId(UI_SCALE_PRESETS.large)).toBe('large');
  expect(getUiScalePresetId(103)).toBe('custom');
});

test('resolves preset values and emits css factor', async () => {
  expect(resolveUiScalePresetValue('compact')).toBe(90);
  expect(resolveUiScalePresetValue('large')).toBe(115);
  expect(resolveUiScalePresetValue('custom', 107)).toBe(107);
  expect(toUiScaleFactor(115)).toBe('1.15');
});
