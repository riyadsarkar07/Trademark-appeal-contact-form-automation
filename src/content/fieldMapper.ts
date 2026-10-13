import { FIELD_ALIASES, aliasScore, normalizeLabel } from '../data/fieldAliases';
import type {
  AppealProfile,
  ExtractedField,
  FieldAliasDefinition,
  FieldMatch,
  MatchConfidence,
  SemanticFieldKey,
} from '../types';
import { getProfileValue } from '../storage/profiles';

interface Candidate {
  fieldIndex: number;
  definition: FieldAliasDefinition;
  score: number;
}

const NAME_KEYWORDS = ['name', 'surname', 'full name', 'legal name', 'contact name'];
const SIGNATURE_KEYWORDS = ['signature', 'sign here', 'e signature', 'esignature', 'type your name'];
const REPORT_KEYWORDS = ['report', 'reference', 'case', 'ticket', 'rpt'];
const EMAIL_KEYWORDS = ['email', 'e mail', 'e-mail'];
const CONTENT_URL_KEYWORDS = [
  'url',
  'urls',
  'description leading',
  'appeared on facebook',
  'removed content',
  'content url',
];
const APPEAL_KEYWORDS = [
  'explain why',
  'should not have been removed',
  'appeal explanation',
  'reason for appeal',
  'why the removal',
  'additional information',
];
const ORG_KEYWORDS = [
  'official',
  'organisation',
  'organization',
  'online presence',
  'page url',
  'facebook page',
  'website',
  'client',
];

function confidenceFromScore(score: number, ambiguous: boolean): MatchConfidence {
  if (ambiguous) {
    return 'ambiguous';
  }
  if (score >= 0.86) {
    return 'high';
  }
  if (score >= 0.6) {
    return 'medium';
  }
  if (score >= 0.4) {
    return 'low';
  }
  return 'none';
}

function localText(field: ExtractedField): string {
  return normalizeLabel(`${field.label} ${field.name} ${field.id}`);
}

function containsAny(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(normalizeLabel(keyword)));
}

function exclusiveScore(field: ExtractedField, definition: FieldAliasDefinition): number {
  if (!definition.kinds.includes(field.kind)) {
    return 0;
  }
  const primary = localText(field);
  const surround = normalizeLabel(field.surroundingText);
  const key = definition.semanticKey;

  if (key === 'fullName') {
    if (containsAny(primary, SIGNATURE_KEYWORDS) || containsAny(primary, REPORT_KEYWORDS) || containsAny(primary, EMAIL_KEYWORDS)) {
      return 0;
    }
    if (!containsAny(primary, NAME_KEYWORDS)) {
      return 0;
    }
  }
  if (key === 'electronicSignature') {
    if (!containsAny(primary, SIGNATURE_KEYWORDS)) {
      return 0;
    }
    if (containsAny(primary, REPORT_KEYWORDS) && !containsAny(primary, SIGNATURE_KEYWORDS)) {
      return 0;
    }
  }
  if (key === 'reportNumber') {
    if (!containsAny(primary, REPORT_KEYWORDS)) {
      return 0;
    }
    if (containsAny(primary, SIGNATURE_KEYWORDS)) {
      return 0;
    }
  }
  if (key === 'contactEmail') {
    if (!containsAny(primary, EMAIL_KEYWORDS) && field.kind !== 'email' && field.type !== 'email') {
      return 0;
    }
  }
  if (key === 'removedContentUrlAndDescription') {
    if (containsAny(primary, ['should not have been removed', 'explain why you believe'])) {
      return 0;
    }
    if (!containsAny(primary, CONTENT_URL_KEYWORDS) && !containsAny(surround, CONTENT_URL_KEYWORDS)) {
      return 0;
    }
  }
  if (key === 'appealExplanation') {
    if (containsAny(primary, ['url s description', 'urls description', 'appeared on facebook']) && !containsAny(primary, APPEAL_KEYWORDS)) {
      return 0;
    }
    if (!containsAny(primary, APPEAL_KEYWORDS) && !containsAny(surround, APPEAL_KEYWORDS)) {
      return 0;
    }
  }
  if (key === 'organizationOrPageUrl') {
    if (containsAny(primary, EMAIL_KEYWORDS) || containsAny(primary, SIGNATURE_KEYWORDS) || containsAny(primary, REPORT_KEYWORDS)) {
      return 0;
    }
    if (containsAny(primary, ['appeared on facebook', 'url s description', 'urls description', 'should not have been removed'])) {
      return 0;
    }
    if (!containsAny(primary, ORG_KEYWORDS) && !containsAny(surround, ORG_KEYWORDS)) {
      return 0;
    }
  }

  let best = 0;
  for (const alias of definition.aliases) {
    const labelScore = aliasScore(normalizeLabel(field.label), alias);
    const attrScore = aliasScore(normalizeLabel(`${field.name} ${field.id}`), alias) * 0.85;
    const surroundScore = aliasScore(surround, alias) * 0.25;
    best = Math.max(best, labelScore, attrScore, surroundScore);
  }
  if (field.kind === 'email' && key === 'contactEmail') {
    best = Math.max(best, 0.92);
  }
  return best;
}

function proposedValue(profile: AppealProfile | null, definition: FieldAliasDefinition): string | undefined {
  if (!profile || !definition.profileKey) {
    return undefined;
  }
  let value = getProfileValue(profile, definition.profileKey).trim();
  if (!value && definition.semanticKey === 'electronicSignature') {
    value = profile.fullName.trim();
  }
  return value || undefined;
}

function closeScores(higher: number, lower: number): boolean {
  return higher - lower < 0.12 && higher < 0.95;
}

export function mapFields(fields: ExtractedField[], profile: AppealProfile | null): FieldMatch[] {
  const candidates: Candidate[] = [];
  for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
    const field = fields[fieldIndex];
    if (!field) {
      continue;
    }
    for (const definition of FIELD_ALIASES) {
      const score = exclusiveScore(field, definition);
      if (score >= 0.4) {
        candidates.push({ fieldIndex, definition, score });
      }
    }
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.fieldIndex - b.fieldIndex;
  });

  const assigned = new Map<number, Candidate>();
  const claimedKeys = new Map<SemanticFieldKey, Candidate>();
  const ambiguous = new Map<number, { semanticKey: SemanticFieldKey; reason: string; definition?: FieldAliasDefinition }>();

  const release = (candidate: Candidate): void => {
    assigned.delete(candidate.fieldIndex);
    const owner = claimedKeys.get(candidate.definition.semanticKey);
    if (owner?.fieldIndex === candidate.fieldIndex) {
      claimedKeys.delete(candidate.definition.semanticKey);
    }
  };

  for (const candidate of candidates) {
    if (ambiguous.has(candidate.fieldIndex)) {
      continue;
    }
    const existingField = assigned.get(candidate.fieldIndex);
    if (existingField) {
      if (
        existingField.definition.semanticKey !== candidate.definition.semanticKey &&
        closeScores(existingField.score, candidate.score)
      ) {
        release(existingField);
        ambiguous.set(candidate.fieldIndex, {
          semanticKey: existingField.definition.semanticKey,
          reason: `Label matched both ${existingField.definition.semanticKey} and ${candidate.definition.semanticKey}.`,
          definition: existingField.definition,
        });
      }
      continue;
    }

    const key = candidate.definition.semanticKey;
    const existingKey = key === 'unknown' ? undefined : claimedKeys.get(key);
    if (existingKey) {
      if (closeScores(existingKey.score, candidate.score) || existingKey.score === candidate.score) {
        release(existingKey);
        const reason = 'Multiple controls mapped to the same semantic field.';
        ambiguous.set(existingKey.fieldIndex, {
          semanticKey: key,
          reason,
          definition: existingKey.definition,
        });
        ambiguous.set(candidate.fieldIndex, {
          semanticKey: key,
          reason,
          definition: candidate.definition,
        });
      }
      continue;
    }

    assigned.set(candidate.fieldIndex, candidate);
    if (key !== 'unknown') {
      claimedKeys.set(key, candidate);
    }
  }

  const mapped = fields.map((field, fieldIndex) => {
    const conflict = ambiguous.get(fieldIndex);
    if (conflict) {
      return {
        field,
        semanticKey: conflict.semanticKey,
        confidence: 'ambiguous' as const,
        reason: conflict.reason,
        profileKey: conflict.definition?.profileKey,
        proposedValue: conflict.definition ? proposedValue(profile, conflict.definition) : undefined,
      };
    }
    const match = assigned.get(fieldIndex);
    if (!match) {
      return {
        field,
        semanticKey: 'unknown' as const,
        confidence: 'none' as const,
        reason: 'No configured alias matched this label with enough confidence.',
      };
    }
    return {
      field,
      semanticKey: match.definition.semanticKey,
      confidence: confidenceFromScore(match.score, false),
      reason: `Matched alias for ${match.definition.semanticKey} (score ${match.score.toFixed(2)}).`,
      profileKey: match.definition.profileKey,
      proposedValue: proposedValue(profile, match.definition),
    };
  });

  return appendUnavailableSignature(mapped, profile);
}

function unavailableField(key: SemanticFieldKey, label: string): ExtractedField {
  return {
    id: `unavailable:${key}`,
    label,
    normalizedLabel: normalizeLabel(label),
    name: '',
    type: 'text',
    kind: 'text',
    required: false,
    disabled: false,
    visible: false,
    currentValue: '',
    checked: null,
    surroundingText: '',
    selectorHint: '',
  };
}

function appendUnavailableSignature(matches: FieldMatch[], profile: AppealProfile | null): FieldMatch[] {
  if (matches.some((item) => item.semanticKey === 'electronicSignature')) {
    return matches;
  }
  const hasAppealFields = matches.some(
    (item) =>
      item.profileKey &&
      (item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'ambiguous'),
  );
  if (!hasAppealFields) {
    return matches;
  }
  const definition = FIELD_ALIASES.find((item) => item.semanticKey === 'electronicSignature');
  if (!definition) {
    return matches;
  }
  return [
    ...matches,
    {
      field: unavailableField('electronicSignature', 'Electronic signature'),
      semanticKey: 'electronicSignature',
      confidence: 'none',
      reason: 'Electronic signature control was not found on this form.',
      profileKey: definition.profileKey,
      proposedValue: proposedValue(profile, definition),
    },
  ];
}

export function countMatchStates(matches: FieldMatch[]): {
  matchedCount: number;
  unmatchedCount: number;
  ambiguousCount: number;
} {
  let matchedCount = 0;
  let unmatchedCount = 0;
  let ambiguousCount = 0;
  for (const match of matches) {
    if (match.confidence === 'ambiguous') {
      ambiguousCount += 1;
    } else if (match.confidence === 'high' || match.confidence === 'medium') {
      matchedCount += 1;
    } else {
      unmatchedCount += 1;
    }
  }
  return { matchedCount, unmatchedCount, ambiguousCount };
}
