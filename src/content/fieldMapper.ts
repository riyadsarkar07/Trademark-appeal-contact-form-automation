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

interface ScoredAlias {
  definition: FieldAliasDefinition;
  score: number;
}

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

function scoreField(field: ExtractedField, definition: FieldAliasDefinition): number {
  if (!definition.kinds.includes(field.kind)) {
    return 0;
  }
  const fullHaystack = `${field.label} ${field.surroundingText} ${field.name} ${field.id}`;
  if (definition.semanticKey === 'reportNumber') {
    const text = normalizeLabel(fullHaystack);
    const hasKeyword = ['report', 'reference', 'case', 'ticket', 'id', 'number', 'rpt'].some((kw) => text.includes(kw));
    if (!hasKeyword) {
      return 0;
    }
  }
  const haystack = normalizeLabel(fullHaystack);
  let best = 0;
  for (const alias of definition.aliases) {
    best = Math.max(best, aliasScore(haystack, alias));
  }
  return best;
}

function topAliases(field: ExtractedField): ScoredAlias[] {
  return FIELD_ALIASES.map((definition) => ({ definition, score: scoreField(field, definition) }))
    .filter((item) => item.score >= 0.4)
    .sort((a, b) => b.score - a.score);
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

export function mapFields(fields: ExtractedField[], profile: AppealProfile | null): FieldMatch[] {
  const usedKeys = new Map<SemanticFieldKey, number>();
  const matches: FieldMatch[] = [];

  for (const field of fields) {
    const ranked = topAliases(field);
    const first = ranked[0];
    const second = ranked[1];
    const ambiguous = Boolean(first && second && first.score - second.score < 0.12 && first.score < 0.95);

    if (!first) {
      matches.push({
        field,
        semanticKey: 'unknown',
        confidence: 'none',
        reason: 'No configured alias matched this label with enough confidence.',
      });
      continue;
    }

    const previous = usedKeys.get(first.definition.semanticKey) ?? 0;
    const duplicate = previous > 0 && first.definition.semanticKey !== 'unknown';
    usedKeys.set(first.definition.semanticKey, previous + 1);

    const confidence = duplicate ? 'ambiguous' : confidenceFromScore(first.score, ambiguous);
    matches.push({
      field,
      semanticKey: first.definition.semanticKey,
      confidence,
      reason: duplicate
        ? 'Multiple controls mapped to the same semantic field.'
        : `Matched alias for ${first.definition.semanticKey} (score ${first.score.toFixed(2)}).`,
      profileKey: first.definition.profileKey,
      proposedValue: proposedValue(profile, first.definition),
    });
  }

  return matches;
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
