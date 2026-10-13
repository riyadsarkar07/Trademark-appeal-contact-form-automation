import { describe, expect, it } from 'vitest';
import { FORM_REGISTRY, hostnameMatchesAllowlist } from '../../src/data/formRegistry';

describe('supported domain validation', () => {
  it('allows approved Meta help/contact hosts', () => {
    expect(hostnameMatchesAllowlist('www.facebook.com', '/help/contact/123')).toBe(true);
    expect(hostnameMatchesAllowlist('business.facebook.com', '/help/contact')).toBe(true);
    expect(hostnameMatchesAllowlist('www.instagram.com', '/help/contact/ip')).toBe(true);
    expect(hostnameMatchesAllowlist('www.meta.com', '/help/contact')).toBe(true);
  });

  it('rejects ordinary Facebook surfaces', () => {
    expect(hostnameMatchesAllowlist('www.facebook.com', '/')).toBe(false);
    expect(hostnameMatchesAllowlist('www.facebook.com', '/messages/t/1')).toBe(false);
    expect(hostnameMatchesAllowlist('www.facebook.com', '/watch')).toBe(false);
  });

  it('rejects unrelated websites', () => {
    expect(hostnameMatchesAllowlist('example.com', '/help/contact')).toBe(false);
    expect(hostnameMatchesAllowlist('accounts.google.com', '/')).toBe(false);
  });

  it('allows local mock hosts for development', () => {
    expect(hostnameMatchesAllowlist('localhost', '/', FORM_REGISTRY)).toBe(true);
    expect(hostnameMatchesAllowlist('127.0.0.1', '/mock/', FORM_REGISTRY)).toBe(true);
  });
});
