import { describe, it, expect } from 'vitest';
import {
  stamp,
  unstamp,
  timingSafeEqual,
  encodeText,
  decodeText,
} from '@/lib/members/crypto';
import { normaliseEmail, isEntitled } from '@/lib/members/members';

const SECRET = 'a-test-secret-that-is-long-enough-to-pass';

describe('members: signing', () => {
  it('round-trips a payload', async () => {
    const token = await stamp(encodeText('hello'), SECRET);
    const payload = await unstamp(token, SECRET);
    expect(payload).not.toBeNull();
    expect(decodeText(payload!)).toBe('hello');
  });

  it('rejects a payload signed with a different secret', async () => {
    const token = await stamp(encodeText('hello'), SECRET);
    expect(await unstamp(token, 'a-different-secret-of-sufficient-length')).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const token = await stamp(encodeText('member'), SECRET);
    const [, signature] = token.split('.');
    const forged = `${encodeText('admin')}.${signature}`;
    expect(await unstamp(forged, SECRET)).toBeNull();
  });

  it('rejects a token with no signature', async () => {
    expect(await unstamp(encodeText('hello'), SECRET)).toBeNull();
    expect(await unstamp('', SECRET)).toBeNull();
    expect(await unstamp('.', SECRET)).toBeNull();
  });
});

describe('members: timing-safe comparison', () => {
  it('matches equal strings and rejects unequal ones', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });
});

describe('members: addresses', () => {
  it('compares case-insensitively and ignores surrounding space', () => {
    expect(normaliseEmail('  Hans@Example.COM ')).toBe('hans@example.com');
  });
});

describe('members: entitlement', () => {
  it('lets any member through content marked `members`', () => {
    expect(isEntitled([], 'members')).toBe(true);
    expect(isEntitled(['pro'], 'members')).toBe(true);
  });

  it('requires the named tier for anything else', () => {
    expect(isEntitled(['pro'], 'pro')).toBe(true);
    expect(isEntitled(['basic'], 'pro')).toBe(false);
    expect(isEntitled([], 'pro')).toBe(false);
  });
});
