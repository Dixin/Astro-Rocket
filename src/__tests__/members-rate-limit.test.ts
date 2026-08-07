import { describe, it, expect, beforeEach } from 'vitest';
import { allowRequest, resetRateLimit } from '@/lib/members/rate-limit';

describe('members: the sign-in brake', () => {
  beforeEach(() => resetRateLimit());

  it('allows a normal number of attempts', () => {
    for (let i = 0; i < 5; i++) {
      expect(allowRequest('hans@example.com')).toBe(true);
    }
  });

  it('stops the sixth attempt in the same window', () => {
    for (let i = 0; i < 5; i++) allowRequest('hans@example.com');
    expect(allowRequest('hans@example.com')).toBe(false);
  });

  it('lets the address through again once the window has passed', () => {
    const start = 1_000_000;
    for (let i = 0; i < 5; i++) allowRequest('hans@example.com', start);
    expect(allowRequest('hans@example.com', start)).toBe(false);
    expect(allowRequest('hans@example.com', start + 61_000)).toBe(true);
  });

  it('counts each address on its own', () => {
    // One person being throttled must not lock anybody else out.
    for (let i = 0; i < 5; i++) allowRequest('hans@example.com');
    expect(allowRequest('hans@example.com')).toBe(false);
    expect(allowRequest('someone@example.com')).toBe(true);
  });

  it('forgets expired entries instead of growing forever', () => {
    const start = 1_000_000;
    for (let i = 0; i < 50; i++) allowRequest(`user${i}@example.com`, start);
    // A later request sweeps the expired window before recording its own.
    expect(allowRequest('new@example.com', start + 61_000)).toBe(true);
    expect(allowRequest('user0@example.com', start + 61_000)).toBe(true);
  });
});
