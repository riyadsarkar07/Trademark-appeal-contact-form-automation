const SAMPLE_PROFILE = {
  id: 'preview-profile',
  name: 'Local preview profile',
  updatedAt: new Date().toISOString(),
  fullName: 'Alex Example',
  organizationOrPageUrl: 'https://example.com/page',
  removedContentUrlAndDescription: 'https://example.com/removed-post\nA product photo that was removed in error.',
  contactEmail: 'alex@example.com',
  reportNumber: 'RPT-1001',
  appealExplanation: 'The reported use is nominative and does not confuse consumers.',
  electronicSignature: 'Alex Example',
};

function $(id) {
  return document.getElementById(id);
}

function show(id, visible) {
  const node = $(id);
  if (node) {
    node.classList.toggle('hidden', !visible);
  }
}

function detect() {
  if (!window.AppealEngine) {
    return { ok: false, error: 'Engine not loaded' };
  }
  return window.AppealEngine.inspectPage(
    { hostname: location.hostname, pathname: location.pathname },
    document,
    true,
    SAMPLE_PROFILE,
  );
}

function fill(overwrite) {
  if (!window.AppealEngine) {
    return { ok: false, error: 'Engine not loaded' };
  }
  return window.AppealEngine.runAutofill(
    { hostname: location.hostname, pathname: location.pathname },
    document,
    SAMPLE_PROFILE,
    Boolean(overwrite),
    null,
  );
}

document.getElementById('appeal-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  window.__appealSubmitted = true;
});

window.MockAppeal = {
  detect,
  fill,
  showOtp: () => show('otp-dialog', true),
  showCaptcha: () => show('captcha-dialog', true),
  hideChallenges: () => {
    show('otp-dialog', false);
    show('captcha-dialog', false);
  },
  profile: SAMPLE_PROFILE,
};

const statusNode = document.getElementById('preview-status');
document.getElementById('preview-detect')?.addEventListener('click', () => {
  const result = detect();
  if (statusNode && result && 'status' in result) {
    statusNode.textContent = `${result.status}: ${result.matchedCount} matched / ${result.fields.length} fields`;
  }
});
document.getElementById('preview-fill')?.addEventListener('click', () => {
  const result = fill(false);
  if (statusNode && result && 'report' in result) {
    statusNode.textContent = `Filled ${result.report.filled}, already correct ${result.report.alreadyCorrect}, skipped ${result.report.skipped}`;
  }
});
document.getElementById('preview-otp')?.addEventListener('click', () => window.MockAppeal.showOtp());
document.getElementById('preview-captcha')?.addEventListener('click', () => window.MockAppeal.showCaptcha());
