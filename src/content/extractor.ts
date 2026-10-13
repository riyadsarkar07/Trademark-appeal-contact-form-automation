import { normalizeLabel } from '../data/fieldAliases';
import type { ExtractedField, FillableControlKind } from '../types';

const CONTROL_SELECTOR = 'input, textarea, select';

const SEARCH_LABEL_PATTERNS = [
  'how can we help',
  'search help',
  'search for help',
  'search the help center',
];

function isVisible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
    return false;
  }
  return true;
}

function isHelpSearchControl(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'search') {
    return true;
  }
  if (element.closest('[role="search"]')) {
    return true;
  }
  const haystack = normalizeLabel(
    [
      element.getAttribute('placeholder') ?? '',
      element.getAttribute('aria-label') ?? '',
      element.getAttribute('name') ?? '',
      element.getAttribute('id') ?? '',
      element.getAttribute('role') ?? '',
    ].join(' '),
  );
  if (haystack === 'search' || haystack.includes('search help') || haystack.includes('search for help')) {
    return true;
  }
  return SEARCH_LABEL_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function kindFromControl(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): FillableControlKind | null {
  if (element instanceof HTMLTextAreaElement) {
    return 'textarea';
  }
  if (element instanceof HTMLSelectElement) {
    return null;
  }
  const type = (element.type || 'text').toLowerCase();
  if (
    type === 'hidden' ||
    type === 'submit' ||
    type === 'button' ||
    type === 'reset' ||
    type === 'image' ||
    type === 'password' ||
    type === 'search'
  ) {
    return null;
  }
  if (type === 'checkbox' || type === 'radio') {
    return 'checkbox';
  }
  if (type === 'file') {
    return 'file';
  }
  if (type === 'email') {
    return 'email';
  }
  if (type === 'url') {
    return 'url';
  }
  return 'text';
}

function labelFor(element: HTMLElement): string {
  const id = element.id;
  if (id) {
    const byFor = element.ownerDocument.querySelector(`label[for="${cssEscape(id)}"]`);
    if (byFor?.textContent) {
      return byFor.textContent.trim();
    }
  }
  const wrapping = element.closest('label');
  if (wrapping) {
    const clone = wrapping.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, textarea, select, button').forEach((node) => node.remove());
    const text = clone.textContent?.trim();
    if (text) {
      return text;
    }
  }
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((ref) => element.ownerDocument.getElementById(ref)?.textContent?.trim() ?? '')
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ');
    }
  }
  const aria = element.getAttribute('aria-label');
  if (aria) {
    return aria.trim();
  }
  const describedBy = element.getAttribute('aria-describedby');
  if (describedBy) {
    const desc = element.ownerDocument.getElementById(describedBy)?.textContent?.trim();
    if (desc) {
      return desc;
    }
  }
  const prev = previousMeaningfulText(element);
  if (prev) {
    return prev;
  }
  return (element.getAttribute('placeholder') ?? element.getAttribute('name') ?? '').trim();
}

function previousMeaningfulText(element: HTMLElement): string {
  let node: ChildNode | null = element.previousSibling;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        return text;
      }
    }
    if (node instanceof HTMLElement) {
      const text = node.textContent?.trim();
      if (text && text.length < 200) {
        return text;
      }
    }
    node = node.previousSibling;
  }
  const group = element.closest('.field, .form-field, .form-row, li, p, div');
  if (group && group !== element) {
    const heading = group.querySelector('label, .label, legend, strong, span');
    const text = heading?.textContent?.trim();
    if (text && text !== element.getAttribute('placeholder')) {
      return text;
    }
  }
  return '';
}

function nearestFieldGroup(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element.parentElement;
  while (current && current !== element.ownerDocument.body) {
    if (current.matches('fieldset, section, .field, .form-field, .form-row, li, p, label')) {
      return current;
    }
    if (current.tagName === 'FORM' || current.tagName === 'MAIN') {
      return null;
    }
    if (current.tagName === 'DIV') {
      const text = (current.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text.length > 0 && text.length <= 280) {
        return current;
      }
    }
    current = current.parentElement;
  }
  return null;
}

function surroundingText(element: HTMLElement): string {
  const group = nearestFieldGroup(element);
  const bits = [
    element.getAttribute('placeholder') ?? '',
    element.getAttribute('name') ?? '',
    element.getAttribute('id') ?? '',
  ];
  if (group) {
    bits.push(group.querySelector('legend, h2, h3, h4, label, .label')?.textContent ?? '');
    const text = (group.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length > 0 && text.length <= 280) {
      bits.push(text);
    }
  }
  return bits.join(' ').replace(/\s+/g, ' ').trim();
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

function currentValue(element: HTMLInputElement | HTMLTextAreaElement): string {
  if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
    return element.checked ? 'true' : 'false';
  }
  if (element instanceof HTMLInputElement && element.type === 'file') {
    return '';
  }
  return element.value ?? '';
}

function selectorHint(element: HTMLElement, index: number): string {
  if (element.id) {
    return `#${cssEscape(element.id)}`;
  }
  const name = element.getAttribute('name');
  if (name) {
    return `[name="${cssEscape(name)}"]`;
  }
  return `${element.tagName.toLowerCase()}[data-meta-appeal-index="${index}"]`;
}

export function extractVisibleFields(root: ParentNode): ExtractedField[] {
  const nodes = Array.from((root as Document | Element).querySelectorAll(CONTROL_SELECTOR)) as Array<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >;
  const fields: ExtractedField[] = [];
  const usedIds = new Set<string>();

  nodes.forEach((element, index) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const kind = kindFromControl(element);
    if (!kind) {
      return;
    }
    if (!isVisible(element)) {
      return;
    }
    const label = labelFor(element);
    const normalized = normalizeLabel(label);
    if (
      isHelpSearchControl(element) ||
      normalized.includes('how can we help') ||
      normalized === 'search' ||
      normalized.includes('search help') ||
      normalized.includes('search for help')
    ) {
      return;
    }
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    let id = element.id || element.getAttribute('name') || `field-${index}`;
    if (usedIds.has(id)) {
      id = `${id}-${index}`;
    }
    usedIds.add(id);
    fields.push({
      id,
      label,
      normalizedLabel: normalizeLabel(label),
      name: element.getAttribute('name') ?? '',
      type: element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase(),
      kind,
      required: element.hasAttribute('required'),
      disabled: Boolean(element.disabled),
      visible: true,
      currentValue: currentValue(input),
      checked:
        element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')
          ? element.checked
          : null,
      surroundingText: surroundingText(element),
      selectorHint: selectorHint(element, index),
    });
  });

  return fields;
}

export function findControl(root: ParentNode, field: ExtractedField): HTMLInputElement | HTMLTextAreaElement | null {
  const scope = root as Document | Element;
  if (field.id && !field.id.startsWith('field-')) {
    const byId = scope.querySelector(`#${cssEscape(field.id)}`);
    if (byId instanceof HTMLInputElement || byId instanceof HTMLTextAreaElement) {
      return byId;
    }
  }
  if (field.selectorHint.startsWith('#') || field.selectorHint.startsWith('[')) {
    try {
      const hinted = scope.querySelector(field.selectorHint);
      if (hinted instanceof HTMLInputElement || hinted instanceof HTMLTextAreaElement) {
        if (!hinted.disabled) {
          return hinted;
        }
      }
    } catch {
      // Invalid selector hints are ignored in favor of name/label fallback.
    }
  }
  if (field.name) {
    const named = Array.from(scope.querySelectorAll(`[name="${cssEscape(field.name)}"]`)).filter(
      (node): node is HTMLInputElement | HTMLTextAreaElement =>
        node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement,
    );
    const visibleNamed = named.find((candidate) => isVisible(candidate) && !candidate.disabled);
    if (visibleNamed) {
      return visibleNamed;
    }
  }
  const candidates = Array.from(scope.querySelectorAll(CONTROL_SELECTOR)) as Array<
    HTMLInputElement | HTMLTextAreaElement
  >;
  return (
    candidates.find((candidate) => {
      if (candidate.disabled || !isVisible(candidate)) {
        return false;
      }
      const label = labelFor(candidate);
      return normalizeLabel(label) === field.normalizedLabel;
    }) ?? null
  );
}
