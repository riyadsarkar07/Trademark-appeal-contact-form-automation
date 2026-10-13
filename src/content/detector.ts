import { FORM_REGISTRY, hostnameMatchesAllowlist } from '../data/formRegistry';
import { normalizeLabel } from '../data/fieldAliases';
import type { FormDetectionResult, FormRegistry, FormSignature, ManualChallenge } from '../types';

const CAPTCHA_PATTERNS = [
  'recaptcha',
  'captcha',
  "i'm not a robot",
  'i am not a robot',
  'security check',
  'g-recaptcha',
];

const OTP_PATTERNS = [
  'verification code',
  'enter the code we sent',
  'one-time',
  'confirmation code',
  'email verification',
  'we sent a code',
];

export function collectVisibleText(root: ParentNode): string {
  const walker = (root as Document | Element).querySelectorAll
    ? Array.from((root as Document | Element).querySelectorAll('h1, h2, h3, h4, legend, label, p, button, span, div'))
    : [];
  return walker
    .slice(0, 400)
    .map((node) => (node.textContent ?? '').trim())
    .filter((text) => text.length > 0 && text.length < 280)
    .join(' \n ')
    .toLowerCase();
}

export function detectChallenges(root: ParentNode): ManualChallenge[] {
  const text = collectVisibleText(root);
  const html = root instanceof Document ? root.documentElement.outerHTML.toLowerCase() : '';
  const haystack = `${text}\n${html}`;
  const challenges: ManualChallenge[] = [];

  if (CAPTCHA_PATTERNS.some((pattern) => haystack.includes(pattern))) {
    challenges.push({ kind: 'captcha', label: 'Security check / reCAPTCHA detected. Manual action required.' });
  }
  if (OTP_PATTERNS.some((pattern) => haystack.includes(pattern))) {
    challenges.push({
      kind: 'email-verification',
      label: 'Email verification dialog detected. Manual action required.',
    });
  }
  return challenges;
}

export function scoreSignature(visibleText: string, signature: FormSignature): { score: number; hits: string[] } {
  const normalized = normalizeLabel(visibleText);
  const hits: string[] = [];
  for (const pattern of [...signature.headingPatterns, ...signature.labelPatterns]) {
    if (normalized.includes(normalizeLabel(pattern))) {
      hits.push(pattern);
    }
  }
  const forbiddenHit = signature.forbiddenPatterns.some((pattern) => normalized.includes(normalizeLabel(pattern)));
  if (forbiddenHit) {
    return { score: 0, hits: [] };
  }
  return { score: hits.length, hits };
}

export function detectSupportedForm(
  locationLike: { hostname: string; pathname: string },
  root: ParentNode,
  extractionEnabled: boolean,
  registry: FormRegistry = FORM_REGISTRY,
): Omit<FormDetectionResult, 'fields' | 'matches' | 'matchedCount' | 'unmatchedCount' | 'ambiguousCount'> {
  const hostname = locationLike.hostname;
  const pathname = locationLike.pathname || '/';

  if (!hostnameMatchesAllowlist(hostname, pathname, registry)) {
    return {
      status: 'unsupported-host',
      hostname,
      formId: null,
      formName: null,
      reason: 'This page is outside the approved Meta trademark appeal form hosts.',
      challenges: [],
      extractionEnabled,
    };
  }

  const challenges = detectChallenges(root);
  const visibleText = collectVisibleText(root);
  let best: { signature: FormSignature; score: number } | null = null;

  for (const signature of registry.signatures) {
    const { score } = scoreSignature(visibleText, signature);
    if (!best || score > best.score) {
      best = { signature, score };
    }
  }

  if (!best || best.score < best.signature.minMatchedSignatures) {
    return {
      status: 'unsupported-form',
      hostname,
      formId: null,
      formName: null,
      reason:
        'A supported trademark appeal form was not identified with enough confidence. Autofill is blocked until the layout can be verified.',
      challenges,
      extractionEnabled,
    };
  }

  if (challenges.length > 0 && best.score < best.signature.minMatchedSignatures + 2) {
    return {
      status: 'manual-action-required',
      hostname,
      formId: best.signature.id,
      formName: best.signature.displayName,
      reason: challenges.map((item) => item.label).join(' '),
      challenges,
      extractionEnabled,
    };
  }

  return {
    status: 'supported',
    hostname,
    formId: best.signature.id,
    formName: best.signature.displayName,
    reason: `Matched ${best.signature.displayName} using configurable form signatures.`,
    challenges,
    extractionEnabled,
  };
}
