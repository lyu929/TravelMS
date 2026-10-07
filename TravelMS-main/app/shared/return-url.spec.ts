import { describe, expect, it } from 'vitest';
import { returnUrl } from './return-url';
describe('return to the requested page after sign-in', () => {
  it('preserves journey details, settings and valid query parameters', () => {
    for (const path of ['/trips/7', '/settings', '/expenses?new=1&trip=7', '/trips/7#activity'])
      expect(returnUrl(path)).toBe(path);
  });
  it('rejects external, malformed and unknown destinations', () => {
    for (const path of [
      null,
      '//example.com',
      'https://example.com',
      '/trips/7/else',
      '/settings-extra',
      '/trips/0',
      '/settings\\evil',
      '/login',
    ])
      expect(returnUrl(path)).toBe('/dashboard');
  });
});
