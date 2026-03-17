import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

const modulePath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../lib/proxmox-api.js'
);
const moduleSource = fs.readFileSync(modulePath, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource, 'utf8').toString('base64')}`;
const mod = await import(moduleUrl);

const { formatGuestOsType } = mod;

test('formats l26 ostype for UI display', async () => {
  expect(formatGuestOsType('l26')).toBe('Linux 2.6+');
});

test('keeps unknown ostype unchanged', async () => {
  expect(formatGuestOsType('debian')).toBe('debian');
});
