import type { FieldAliasDefinition } from '../types';

export const FIELD_ALIASES: FieldAliasDefinition[] = [
  {
    semanticKey: 'fullName',
    profileKey: 'fullName',
    fillPolicy: 'autofill',
    kinds: ['text'],
    aliases: [
      'full name',
      'your full name',
      'name',
      'contact name',
      'legal name',
      'first and last name',
      'your name name and surname',
      'your name (name and surname)',
      'your name',
      'name and surname',
    ],
  },
  {
    semanticKey: 'organizationOrPageUrl',
    profileKey: 'organizationOrPageUrl',
    fillPolicy: 'autofill',
    kinds: ['text', 'url', 'textarea'],
    aliases: [
      'official organization',
      'client',
      'facebook page url',
      'page url',
      'organization url',
      'official organization, client, or facebook page url',
      'business page',
      'please provide a link to your organisation s or client s official online presence e g a website facebook page etc',
      'please provide a link to your organisations or clients official online presence',
      'official online presence',
      'link to your organisation',
      'organisation or client official online presence',
    ],
  },
  {
    semanticKey: 'removedContentUrlAndDescription',
    profileKey: 'removedContentUrlAndDescription',
    fillPolicy: 'autofill',
    kinds: ['text', 'url', 'textarea'],
    aliases: [
      'please provide url(s)/description leading to where the content appeared on facebook',
      'url(s)/description leading to where the content appeared on facebook',
      'url(s) and description identifying the removed content',
      'urls and description identifying the removed content',
      'removed content url and description',
      'url(s) and description leading to where the content appeared on facebook',
      'removed content url',
      'content url',
      'please provide url s description leading to where the content appeared on facebook',
    ],
  },
  {
    semanticKey: 'contactEmail',
    profileKey: 'contactEmail',
    fillPolicy: 'autofill',
    kinds: ['email', 'text'],
    aliases: ['contact email', 'email', 'email address', 'your email', 'e-mail'],
  },
  {
    semanticKey: 'reportNumber',
    profileKey: 'reportNumber',
    fillPolicy: 'autofill',
    kinds: ['text'],
    aliases: [
      'report number',
      'reference number',
      'case number',
      'ticket number',
      'report id',
      'report no',
    ],
  },
  {
    semanticKey: 'contentMissingCheckbox',
    fillPolicy: 'manual-review',
    kinds: ['checkbox'],
    aliases: [
      'content is missing',
      'cannot be located',
      'i cannot find the content',
      'missing or cannot be located',
      'the content is missing or cannot be located',
      'i cannot see the content that i wish to appeal, or some of the content is missing',
      'i cannot see the content that i wish to appeal',
      'some of the content is missing',
    ],
  },
  {
    semanticKey: 'appealExplanation',
    profileKey: 'appealExplanation',
    fillPolicy: 'autofill',
    kinds: ['textarea', 'text'],
    aliases: [
      'please explain why you believe that the content should not have been removed.',
      'please explain why you believe that the content should not have been removed',
      'explain why you believe that the content should not have been removed',
      'appeal explanation for missing content why the removal may have been a mistake',
      'appeal explanation',
      'why the removal may have been a mistake',
      'explain why',
      'additional information',
      'please explain',
      'reason for appeal',
    ],
  },
  {
    semanticKey: 'declarationCheckbox',
    fillPolicy: 'manual-review',
    kinds: ['checkbox'],
    aliases: [
      'declaration',
      'i declare',
      'i confirm',
      'i certify',
      'under penalty',
      'good faith',
      'i understand',
      'i declare that this appeal is submitted in good faith',
    ],
  },
  {
    semanticKey: 'electronicSignature',
    profileKey: 'electronicSignature',
    fillPolicy: 'autofill',
    kinds: ['text'],
    aliases: [
      'electronic signature',
      'signature',
      'type your name',
      'sign here',
      'e-signature',
    ],
  },
  {
    semanticKey: 'attachment',
    fillPolicy: 'never',
    kinds: ['file'],
    aliases: ['attachment', 'upload', 'choose file', 'supporting document', 'optional attachment'],
  },
  {
    semanticKey: 'captcha',
    fillPolicy: 'never',
    kinds: ['text', 'checkbox', 'textarea'],
    aliases: ['captcha', 'recaptcha', 'i am not a robot', 'security check', "i'm not a robot"],
  },
  {
    semanticKey: 'otp',
    fillPolicy: 'never',
    kinds: ['text'],
    aliases: [
      'verification code',
      'one-time code',
      'otp',
      'security code',
      'email code',
      'enter the code',
      'confirmation code',
    ],
  },
  {
    semanticKey: 'submit',
    fillPolicy: 'never',
    kinds: ['text'],
    aliases: ['send', 'submit', 'submit appeal', 'send appeal'],
  },
];

export function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[*：:]/g, ' ')
    .replace(/\(s\)/g, 's')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function aliasScore(normalizedLabel: string, alias: string): number {
  const normalizedAlias = normalizeLabel(alias);
  if (!normalizedLabel || !normalizedAlias) {
    return 0;
  }
  if (normalizedLabel === normalizedAlias) {
    return 1;
  }
  if (normalizedLabel.includes(normalizedAlias) || normalizedAlias.includes(normalizedLabel)) {
    return 0.86;
  }
  const labelTokens = new Set(normalizedLabel.split(' ').filter(Boolean));
  const aliasTokens = normalizedAlias.split(' ').filter(Boolean);
  if (aliasTokens.length === 0) {
    return 0;
  }
  const overlap = aliasTokens.filter((token) => labelTokens.has(token)).length;
  return overlap / aliasTokens.length;
}
