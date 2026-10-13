import { describe, expect, it } from 'vitest';
import { detectChallenges, detectSupportedForm } from '../../src/content/detector';

function mount(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

const APPEAL_MARKUP = `
  <h1>Trademark Appeal Contact Form</h1>
  <h2>Contact Information</h2>
  <label>Full name</label>
  <h2>Reported Content At Issue</h2>
  <label>Report number</label>
  <h2>Appeal explanation</h2>
  <label>Electronic signature</label>
  <h2>Declaration</h2>
`;

describe('form detection', () => {
  it('identifies a supported trademark appeal form on an allowlisted host', () => {
    mount(APPEAL_MARKUP);
    const result = detectSupportedForm(
      { hostname: 'www.facebook.com', pathname: '/help/contact/1' },
      document,
      true,
    );
    expect(result.status).toBe('supported');
    expect(result.formId).toBe('meta-trademark-appeal-contact');
  });

  it('detects unsupported layouts', () => {
    mount('<h1>News Feed</h1><p>Create post</p><button>Share</button>');
    const result = detectSupportedForm(
      { hostname: 'www.facebook.com', pathname: '/help/contact/1' },
      document,
      true,
    );
    expect(result.status).toBe('unsupported-form');
  });

  it('blocks non-allowlisted hosts even if the markup looks similar', () => {
    mount(APPEAL_MARKUP);
    const result = detectSupportedForm({ hostname: 'evil.example', pathname: '/help/contact' }, document, true);
    expect(result.status).toBe('unsupported-host');
  });

  it('flags CAPTCHA and OTP dialogs as manual action required', () => {
    mount(`${APPEAL_MARKUP}<div>Security Check reCAPTCHA I'm not a robot</div><div>Enter the code we sent</div>`);
    const challenges = detectChallenges(document);
    expect(challenges.some((item) => item.kind === 'captcha')).toBe(true);
    expect(challenges.some((item) => item.kind === 'email-verification')).toBe(true);
  });
});
