export const PROFILE_FIELDS = [
  'fullName',
  'organizationOrPageUrl',
  'removedContentUrlAndDescription',
  'contactEmail',
  'reportNumber',
  'appealExplanation',
  'electronicSignature',
] as const;

export type ProfileFieldKey = (typeof PROFILE_FIELDS)[number];

export interface AppealProfile {
  id: string;
  name: string;
  updatedAt: string;
  fullName: string;
  organizationOrPageUrl: string;
  removedContentUrlAndDescription: string;
  contactEmail: string;
  reportNumber: string;
  appealExplanation: string;
  electronicSignature: string;
}

export type FillableControlKind = 'text' | 'textarea' | 'email' | 'url' | 'checkbox' | 'file';

export type SemanticFieldKey =
  | ProfileFieldKey
  | 'contentMissingCheckbox'
  | 'declarationCheckbox'
  | 'attachment'
  | 'captcha'
  | 'otp'
  | 'submit'
  | 'unknown';

export interface ExtractedField {
  id: string;
  label: string;
  normalizedLabel: string;
  name: string;
  type: string;
  kind: FillableControlKind;
  required: boolean;
  disabled: boolean;
  visible: boolean;
  currentValue: string;
  checked: boolean | null;
  surroundingText: string;
  selectorHint: string;
}

export interface FieldAliasDefinition {
  semanticKey: SemanticFieldKey;
  aliases: string[];
  kinds: FillableControlKind[];
  fillPolicy: 'autofill' | 'manual-review' | 'never';
  profileKey?: ProfileFieldKey;
}

export interface FormSignature {
  id: string;
  displayName: string;
  requiredHostAllowlist: boolean;
  minMatchedSignatures: number;
  headingPatterns: string[];
  labelPatterns: string[];
  forbiddenPatterns: string[];
}

export interface DomainAllowlistEntry {
  hostname: string;
  pathPrefixes: string[];
}

export interface FormRegistry {
  allowlist: DomainAllowlistEntry[];
  signatures: FormSignature[];
  localDevHosts: string[];
}

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none' | 'ambiguous';

export interface FieldMatch {
  field: ExtractedField;
  semanticKey: SemanticFieldKey;
  confidence: MatchConfidence;
  reason: string;
  profileKey?: ProfileFieldKey;
  proposedValue?: string;
}

export type DetectionStatus =
  | 'idle'
  | 'unsupported-host'
  | 'unsupported-form'
  | 'supported'
  | 'manual-action-required'
  | 'error';

export interface ManualChallenge {
  kind: 'captcha' | 'otp' | 'email-verification';
  label: string;
}

export interface FormDetectionResult {
  status: DetectionStatus;
  hostname: string;
  formId: string | null;
  formName: string | null;
  reason: string;
  fields: ExtractedField[];
  matches: FieldMatch[];
  matchedCount: number;
  unmatchedCount: number;
  ambiguousCount: number;
  challenges: ManualChallenge[];
  extractionEnabled: boolean;
}

export type FillOutcome =
  | 'filled'
  | 'already-correct'
  | 'skipped-existing-value'
  | 'skipped-existing'
  | 'skipped-manual'
  | 'skipped-uncertain'
  | 'skipped-duplicate'
  | 'skipped-empty-profile'
  | 'skipped-protected'
  | 'failed';

export interface FieldFillResult {
  fieldId: string;
  label: string;
  semanticKey: SemanticFieldKey;
  outcome: FillOutcome;
  message: string;
}

export interface AutofillRequest {
  profile: AppealProfile;
  overwriteExisting: boolean;
  fillProtectedLegal: boolean;
}

export interface AutofillReport {
  filled: number;
  skipped: number;
  failed: number;
  results: FieldFillResult[];
  blockedReason: string | null;
  fingerprint: string | null;
}

export type RuntimeMessageType =
  | 'PING'
  | 'GET_STATUS'
  | 'SET_EXTRACTION'
  | 'DETECT_FORM'
  | 'AUTOFILL'
  | 'GET_SETTINGS';

export interface RuntimeMessage {
  type: RuntimeMessageType;
  payload?: {
    enabled?: boolean;
    request?: AutofillRequest;
  };
}

export interface RuntimeResponse {
  ok: boolean;
  error?: string;
  detection?: FormDetectionResult;
  report?: AutofillReport;
}

export interface ExtensionSettings {
  extractionEnabled: boolean;
  activeProfileId: string | null;
  lastFilledFingerprint: string | null;
}

export interface StorageSnapshot {
  profiles: AppealProfile[];
  settings: ExtensionSettings;
}

export interface ProfileImportPayload {
  version: 1;
  profiles: AppealProfile[];
}
