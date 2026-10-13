# Meta Appeal AutoFill

Chrome extension (Manifest V3) that detects supported Meta trademark appeal contact forms, extracts visible field labels, matches them to a locally stored profile, and fills only confidently matched fields after you click Auto-Fill.

This is a form-filling assistant. It does not submit appeals, solve CAPTCHA, enter email verification codes, upload attachments, or check legal declarations for you.

## What it does

- Verifies the current hostname against an explicit Meta help/contact allowlist
- Identifies a supported trademark appeal form using configurable signatures
- Extracts visible, enabled controls and their labels
- Matches labels to configurable field aliases
- Fills only high/medium-confidence matches from the selected local profile
- Preserves existing non-empty values unless you enable overwrite
- Reports matched, unmatched, and ambiguous fields in the popup

## What it never does

- Never clicks Send or Submit
- Never bypasses or solves CAPTCHA / reCAPTCHA
- Never enters OTP or email verification codes
- Never auto-checks declaration or legal confirmation boxes
- Never uploads or transmits attachments
- Never talks to a backend or private Meta API
- Never runs on ordinary Facebook feeds, Messenger, or unrelated sites

## Project structure

```text
manifest.json
package.json
vite.config.ts
src/
  background/index.ts
  content/
    index.ts
    engine.ts
    detector.ts
    extractor.ts
    fieldMapper.ts
    autofill.ts
  data/
    formRegistry.ts
    fieldAliases.ts
  storage/profiles.ts
  types/index.ts
  popup/
  settings/
  styles/
  ui/
mock/                 Local trademark-appeal form for tests and preview
tests/unit/           Vitest + jsdom
tests/e2e/            Playwright against the mock form
```

## Install dependencies

```bash
npm install
```

## Build the extension

```bash
npm run build
```

The packed extension output is written to `dist/`.

## Typecheck, lint, and tests

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

`npm test` runs Vitest unit tests with mocked DOM fixtures.

`npm run test:e2e` builds the local engine bundle and runs Playwright against `mock/index.html`.

## Load unpacked in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the `dist` directory from this project.
6. Pin Meta Appeal AutoFill if you want the popup handy.
7. Open a supported help/contact form, or open `mock/index.html` through a local static server for practice.

The content script is limited to Meta help/contact URLs plus `localhost` / `127.0.0.1` so you can exercise the mock form.

## Use the extension

1. Open Settings and create a local profile. Do not invent missing case details.
2. Open a supported trademark appeal contact form.
3. Click Detect Current Form.
4. Review matched and unmatched fields.
5. Click Auto-Fill. Existing values stay unless you enable overwrite.
6. Review declaration checkboxes, attachments, CAPTCHA, and email verification yourself.
7. Submit the form yourself if it is correct.

The combined removed-content field is stored as `removedContentUrlAndDescription`. Older profiles that used separate URL and description properties are migrated on load and import.

If the popup reports that the content script is missing, open a supported help/contact URL or the local mock form and click Detect again. The popup will try to inject `content.js` once.

Autofill never clicks Send/Submit, never fills CAPTCHA or OTP, and never checks legal declarations.

## Known limitations

- Real Meta form DOM is not verified in this repository. Detection uses configurable signatures and label aliases rather than unpublished internal selectors.
- If Meta changes the layout enough that signatures no longer match, the popup warns and autofill stays blocked.
- Cross-origin iframes cannot be read or filled. The extension explains that limitation instead of trying to bypass it.
- Host permissions are limited to help/contact paths. The extension will not run on facebook.com feeds or messenger threads.
- CAPTCHA, OTP, declaration review, attachments, and final submission remain manual.
- The unrelated “How can we help?” help-center search box is ignored and is never filled.

## Safety confirmation

CAPTCHA, OTP / email verification, declaration checkboxes, optional attachments, and the final Send button remain under manual user control. The fill engine refuses to interact with those controls.
