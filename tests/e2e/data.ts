import { type APIRequestContext, expect } from '@playwright/test';
import { Manifest, RaceRecord } from '../../src/domain/schema.ts';

export const BASE = '/Tyres/';
export const SEPANG = `${BASE}2026/sepang/`;

/** Read the served dataset, so latest-race checks survive new preview publications. */
export async function publishedLatest(request: APIRequestContext) {
  const response = await request.get(`${BASE}data/manifest.json`);
  expect(response.ok()).toBe(true);
  const manifest = Manifest.parse(await response.json());
  expect(manifest.latest).not.toBeNull();
  const summary = manifest.years.flatMap((y) => y.races).find((r) => r.id === manifest.latest);
  expect(summary).toBeDefined();
  const recordResponse = await request.get(`${BASE}data/races/${manifest.latest}.json`);
  expect(recordResponse.ok()).toBe(true);
  const record = RaceRecord.parse(await recordResponse.json());
  expect(record.id).toBe(manifest.latest);
  return { manifest, record };
}
