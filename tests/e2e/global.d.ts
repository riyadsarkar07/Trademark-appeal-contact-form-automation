export {};

declare global {
  interface Window {
    AppealEngine?: {
      inspectPage: (
        locationLike: { hostname: string; pathname: string },
        root: ParentNode,
        extractionEnabled: boolean,
        profile: unknown,
      ) => {
        status: string;
        fields: unknown[];
        matchedCount: number;
        reason: string;
      };
      runAutofill: (
        locationLike: { hostname: string; pathname: string },
        root: ParentNode,
        profile: unknown,
        overwriteExisting: boolean,
        previousFingerprint: string | null,
      ) => {
        detection: { status: string };
        report: { filled: number; skipped: number; blockedReason: string | null };
      };
    };
    MockAppeal: {
      detect: () => {
        status: string;
        fields: unknown[];
        matchedCount: number;
      };
      fill: (overwrite?: boolean) => {
        report: { filled: number; skipped: number; blockedReason: string | null };
      };
      showOtp: () => void;
      showCaptcha: () => void;
      hideChallenges: () => void;
    };
    __appealSubmitted?: boolean;
  }
}
