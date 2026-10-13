import { FIELD_ALIASES } from '../data/fieldAliases';
import { fingerprintFill } from '../storage/profiles';
import type {
  AppealProfile,
  AutofillReport,
  FieldFillResult,
  FieldMatch,
  FillOutcome,
  SemanticFieldKey,
} from '../types';
import { findControl } from './extractor';

const NEVER_FILL: SemanticFieldKey[] = ['captcha', 'otp', 'attachment', 'submit', 'unknown'];
const MANUAL_REVIEW: SemanticFieldKey[] = ['declarationCheckbox', 'contentMissingCheckbox'];

interface TrackedControl {
  _valueTracker?: { setValue: (value: string) => void };
}

function policyFor(key: SemanticFieldKey): 'autofill' | 'manual-review' | 'never' {
  return FIELD_ALIASES.find((item) => item.semanticKey === key)?.fillPolicy ?? 'never';
}

function dispatchInputEvents(element: HTMLInputElement | HTMLTextAreaElement): void {
  element.dispatchEvent(new Event('focus', { bubbles: true }));
  try {
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: element.value,
      }),
    );
  } catch {
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

function nativeSetValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  const tracker = (element as HTMLInputElement & TrackedControl)._valueTracker;
  if (tracker && typeof tracker.setValue === 'function') {
    tracker.setValue('');
  }
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function valuesMatch(current: string, proposed: string): boolean {
  return current.trim() === proposed.trim();
}

function fillText(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  overwriteExisting: boolean,
): FillOutcome {
  const current = element.value;
  const proposed = value ?? '';
  if (valuesMatch(current, proposed) && proposed.trim()) {
    return 'already-correct';
  }
  if (current.trim() && !overwriteExisting) {
    return 'skipped-existing-value';
  }

  const attempt = (): void => {
    nativeSetValue(element, proposed);
    dispatchInputEvents(element);
  };

  attempt();
  if (!valuesMatch(element.value, proposed)) {
    attempt();
  }
  if (!valuesMatch(element.value, proposed)) {
    throw new Error('Fill verification failed: the control did not keep the profile value.');
  }
  return 'filled';
}

export function buildAutofillPlan(matches: FieldMatch[]): FieldMatch[] {
  return matches.filter((match) => match.confidence === 'high' || match.confidence === 'medium');
}

function tally(results: FieldFillResult[]): Pick<AutofillReport, 'filled' | 'skipped' | 'failed'> {
  let filled = 0;
  let skipped = 0;
  let failed = 0;
  for (const result of results) {
    if (result.outcome === 'filled') {
      filled += 1;
    } else if (result.outcome === 'failed') {
      failed += 1;
    } else {
      skipped += 1;
    }
  }
  return { filled, skipped, failed };
}

export function applyAutofill(options: {
  root: ParentNode;
  matches: FieldMatch[];
  profile: AppealProfile;
  overwriteExisting: boolean;
  fillProtectedLegal: boolean;
  previousFingerprint?: string | null;
}): AutofillReport {
  void options.previousFingerprint;
  const confident = buildAutofillPlan(options.matches);
  const fieldIds = confident.map((item) => item.field.id);
  const fingerprint = fingerprintFill(options.profile.id, fieldIds);
  const results = options.matches.map((match) => fillOne(options.root, match, options));

  return {
    ...tally(results),
    results,
    blockedReason: null,
    fingerprint,
  };
}

function fillOne(
  root: ParentNode,
  match: FieldMatch,
  options: {
    overwriteExisting: boolean;
    fillProtectedLegal: boolean;
  },
): FieldFillResult {
  const base = {
    fieldId: match.field.id,
    label: match.field.label,
    semanticKey: match.semanticKey,
  };

  if (NEVER_FILL.includes(match.semanticKey) || policyFor(match.semanticKey) === 'never') {
    return {
      ...base,
      outcome: 'skipped-unsupported',
      message: 'This control is protected and will never be filled automatically.',
    };
  }

  if (match.confidence === 'ambiguous') {
    return {
      ...base,
      outcome: 'skipped-ambiguous',
      message: 'Field mapping was ambiguous, so it was left unchanged.',
    };
  }

  if (match.confidence === 'low' || match.confidence === 'none') {
    return {
      ...base,
      outcome: 'skipped-ambiguous',
      message: 'Field was not matched with enough confidence.',
    };
  }

  if (MANUAL_REVIEW.includes(match.semanticKey) && !options.fillProtectedLegal) {
    return {
      ...base,
      outcome: 'skipped-manual',
      message: 'Legal confirmation left for manual review.',
    };
  }

  if (!match.proposedValue && match.field.kind !== 'checkbox') {
    return {
      ...base,
      outcome: 'skipped-empty-profile',
      message: 'No saved profile value for this field.',
    };
  }

  const control = findControl(root, match.field);
  if (!control) {
    return { ...base, outcome: 'failed', message: 'The form control could not be located in the page.' };
  }
  if (control.disabled) {
    return { ...base, outcome: 'failed', message: 'The form control is disabled.' };
  }

  try {
    if (match.field.kind === 'checkbox') {
      return {
        ...base,
        outcome: 'skipped-manual',
        message: 'Checkboxes that confirm legal statements must be selected by the user.',
      };
    }
    const outcome = fillText(control, match.proposedValue ?? '', options.overwriteExisting);
    let message = 'Filled from the selected profile.';
    if (outcome === 'already-correct') {
      message = 'Field already contains the correct profile value.';
    } else if (outcome === 'skipped-existing-value') {
      message = 'Existing value was preserved (overwrite is disabled).';
    }
    return {
      ...base,
      outcome,
      message,
    };
  } catch (error) {
    return {
      ...base,
      outcome: 'failed',
      message: error instanceof Error ? error.message : 'Unexpected fill error.',
    };
  }
}

export function neverActivateSubmit(root: ParentNode): boolean {
  const buttons = Array.from(
    (root as Document | Element).querySelectorAll('button, input[type="submit"], input[type="button"]'),
  );
  return buttons.every((button) => {
    const el = button as HTMLButtonElement | HTMLInputElement;
    return !el.dataset.metaAppealClicked;
  });
}
