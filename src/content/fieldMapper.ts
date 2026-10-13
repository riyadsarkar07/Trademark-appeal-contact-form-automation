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
  const label = normalizeLabel(field.label);
  const attrs = normalizeLabel(`${field.name} ${field.id}`);
  const surround = normalizeLabel(field.surroundingText);
  const localText = `${label} ${attrs}`.trim();
  if (definition.semanticKey === 'reportNumber') {
    const hasKeyword = ['report', 'reference', 'case', 'ticket', 'rpt'].some((kw) => localText.includes(kw));
    if (!hasKeyword) {
      return 0;
    }
  }
  if (definition.semanticKey === 'electronicSignature') {
    const hasSignature = ['signature', 'sign here', 'e signature', 'esignature', 'type your name'].some((kw) =>
      localText.includes(normalizeLabel(kw)),
    );
    if (!hasSignature) {
      return 0;
    }
  }
  let best = 0;
  for (const alias of definition.aliases) {
    const labelScore = aliasScore(label, alias);
    const attrScore = aliasScore(attrs, alias) * 0.85;
    const surroundScore = aliasScore(surround, alias) * 0.4;
    best = Math.max(best, labelScore, attrScore, surroundScore);
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
  const claimed = new Map<SemanticFieldKey, number>();
  const matches: FieldMatch[] = [];

  for (const field of fields) {
    const ranked = topAliases(field);
    const first = ranked[0];
    const second = ranked[1];

    if (!first) {
      matches.push({
        field,
        semanticKey: 'unknown',
        confidence: 'none',
        reason: 'No configured alias matched this label with enough confidence.',
      });
      continue;
    }

    const closeCall = Boolean(
      second &&
        first.definition.semanticKey !== second.definition.semanticKey &&
        first.score - second.score < 0.12 &&
        first.score < 0.95,
    );
    if (closeCall) {
      matches.push({
        field,
        semanticKey: first.definition.semanticKey,
        confidence: 'ambiguous',
        reason: `Label matched both ${first.definition.semanticKey} and ${second?.definition.semanticKey}.`,
        profileKey: first.definition.profileKey,
        proposedValue: proposedValue(profile, first.definition),
      });
      continue;
    }

    const previousIndex = claimed.get(first.definition.semanticKey);
    if (previousIndex !== undefined && first.definition.semanticKey !== 'unknown') {
      const prior = matches[previousIndex];
      if (prior) {
        matches[previousIndex] = {
          ...prior,
          confidence: 'ambiguous',
          reason: 'Multiple controls mapped to the same semantic field.',
        };
      }
      matches.push({
        field,
        semanticKey: first.definition.semanticKey,
        confidence: 'ambiguous',
        reason: 'Multiple controls mapped to the same semantic field.',
        profileKey: first.definition.profileKey,
        proposedValue: proposedValue(profile, first.definition),
      });
      continue;
    }

    claimed.set(first.definition.semanticKey, matches.length);
    matches.push({
      field,
      semanticKey: first.definition.semanticKey,
      confidence: confidenceFromScore(first.score, false),
      reason: `Matched alias for ${first.definition.semanticKey} (score ${first.score.toFixed(2)}).`,
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
