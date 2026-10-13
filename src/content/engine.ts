import type { AppealProfile, AutofillReport, FormDetectionResult, RuntimeMessage, RuntimeResponse } from '../types';
import { detectSupportedForm } from './detector';
import { extractVisibleFields } from './extractor';
import { countMatchStates, mapFields } from './fieldMapper';
import { applyAutofill } from './autofill';

export interface EngineState {
  extractionEnabled: boolean;
  lastFingerprint: string | null;
}

export function inspectPage(
  locationLike: { hostname: string; pathname: string },
  root: ParentNode,
  extractionEnabled: boolean,
  profile: AppealProfile | null,
): FormDetectionResult {
  const base = detectSupportedForm(locationLike, root, extractionEnabled);
  if (!extractionEnabled) {
    return {
      ...base,
      fields: [],
      matches: [],
      matchedCount: 0,
      unmatchedCount: 0,
      ambiguousCount: 0,
      reason: 'Extraction is turned off.',
      status: base.status === 'unsupported-host' ? base.status : 'idle',
    };
  }
  if (base.status !== 'supported' && base.status !== 'manual-action-required') {
    return {
      ...base,
      fields: [],
      matches: [],
      matchedCount: 0,
      unmatchedCount: 0,
      ambiguousCount: 0,
    };
  }
  const fields = extractVisibleFields(root);
  const matches = mapFields(fields, profile);
  const counts = countMatchStates(matches);
  return {
    ...base,
    fields,
    matches,
    ...counts,
  };
}

export function runAutofill(
  locationLike: { hostname: string; pathname: string },
  root: ParentNode,
  profile: AppealProfile,
  overwriteExisting: boolean,
  previousFingerprint: string | null,
): { detection: FormDetectionResult; report: AutofillReport } {
  const detection = inspectPage(locationLike, root, true, profile);
  if (detection.status !== 'supported') {
    return {
      detection,
      report: {
        filled: 0,
        skipped: 0,
        failed: 0,
        results: [],
        blockedReason: detection.reason,
        fingerprint: null,
      },
    };
  }
  const report = applyAutofill({
    root,
    matches: detection.matches,
    profile,
    overwriteExisting,
    fillProtectedLegal: false,
    previousFingerprint,
  });
  return { detection, report };
}

export function handleRuntimeMessage(
  message: RuntimeMessage,
  ctx: {
    locationLike: { hostname: string; pathname: string };
    root: ParentNode;
    state: EngineState;
    profile: AppealProfile | null;
  },
): RuntimeResponse {
  if (message.type === 'PING') {
    return { ok: true };
  }
  if (message.type === 'SET_EXTRACTION') {
    ctx.state.extractionEnabled = Boolean(message.payload?.enabled);
    return {
      ok: true,
      detection: inspectPage(ctx.locationLike, ctx.root, ctx.state.extractionEnabled, ctx.profile),
    };
  }
  if (message.type === 'DETECT_FORM' || message.type === 'GET_STATUS') {
    return {
      ok: true,
      detection: inspectPage(ctx.locationLike, ctx.root, ctx.state.extractionEnabled, ctx.profile),
    };
  }
  if (message.type === 'AUTOFILL') {
    const request = message.payload?.request;
    if (!request) {
      return { ok: false, error: 'Missing autofill request.' };
    }
    const result = runAutofill(
      ctx.locationLike,
      ctx.root,
      request.profile,
      request.overwriteExisting,
      ctx.state.lastFingerprint,
    );
    if (result.report.fingerprint) {
      ctx.state.lastFingerprint = result.report.fingerprint;
    }
    return { ok: true, detection: result.detection, report: result.report };
  }
  return { ok: false, error: 'Unknown message.' };
}

export const AppealEngine = {
  inspectPage,
  runAutofill,
  handleRuntimeMessage,
};

declare global {
  interface Window {
    AppealEngine: typeof AppealEngine;
  }
}

if (typeof window !== 'undefined') {
  window.AppealEngine = AppealEngine;
}
