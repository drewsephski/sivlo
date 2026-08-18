import { describe, expect, test } from 'bun:test';
import { brand } from '@/config/brand';
import { APP_VERSION } from '@/config/version';

describe('production readiness smoke', () => {
  test('brand identity is Sivlo', () => {
    expect(brand.name).toBe('Sivlo');
    expect(brand.wordmark).toBe('sivlo');
    expect(brand.tagline).toContain('working memory');
  });

  test('app version matches package manifest', () => {
    expect(APP_VERSION).toBe('0.1.1');
  });

  test('privacy tagline emphasizes on-device processing', () => {
    expect(brand.description.toLowerCase()).toContain('device');
  });
});
