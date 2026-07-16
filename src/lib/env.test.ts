// Verifies isDesktop() correctly identifies the Electron-forked Next server
// via a FLOWR_DESKTOP env var, so server-side rendering on Electron matches
// what the Electron client will render (avoiding a hydration mismatch where
// the server renders the web layout and the client renders the desktop one).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isDesktop, isWeb } from './env';

describe('isDesktop() server-side (no window) behavior', () => {
  const ORIGINAL_ENV = process.env.FLOWR_DESKTOP;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.FLOWR_DESKTOP;
    } else {
      process.env.FLOWR_DESKTOP = ORIGINAL_ENV;
    }
  });

  it('returns true server-side when FLOWR_DESKTOP=1 (the Electron-forked server)', () => {
    process.env.FLOWR_DESKTOP = '1';
    expect(isDesktop()).toBe(true);
  });

  it('returns false server-side when FLOWR_DESKTOP is unset (the web server)', () => {
    delete process.env.FLOWR_DESKTOP;
    expect(isDesktop()).toBe(false);
  });

  it('returns false server-side when FLOWR_DESKTOP is set to something other than "1"', () => {
    process.env.FLOWR_DESKTOP = 'true'; // must be the literal string '1', not truthy-any-string
    expect(isDesktop()).toBe(false);
  });

  it('isWeb() is the exact inverse of isDesktop() in the FLOWR_DESKTOP=1 case', () => {
    process.env.FLOWR_DESKTOP = '1';
    expect(isWeb()).toBe(false);
  });
});
