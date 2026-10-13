import { normalizeLabel } from '../data/fieldAliases';
import type { ExtractedField, FillableControlKind } from '../types';

const CONTROL_SELECTOR = 'input, textarea, select';

const SEARCH_LABEL_PATTERNS = [
  'how can we help',
  'search help',
  'search for help',
  'search the help center',
];

const FIELD_GROUP_SELECTOR = 'fieldset, section, .field, .form-field, .form-row, li, p, label';

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
  if (type === 'radio') {
    return 'radio';
  }
  if (type === 'checkbox') {
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

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

function textWithoutControls(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('input, textarea, select, button').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function associatedLabelText(element: HTMLElement): string {
  const id = element.id;
  if (id) {
    const byFor = element.ownerDocument.querySelector(`label[for="${cssEscape(id)}"]`);
    if (byFor instanceof HTMLElement) {
      const text = textWithoutControls(byFor);
      if (text) {
        return text;
      }
    }
  }
  const wrapping = element.closest('label');
  if (wrapping instanceof HTMLElement) {
    const nestedControls = wrapping.querySelectorAll(CONTROL_SELECTOR);
    if (nestedControls.length <= 1) {
      const text = textWithoutControls(wrapping);
      if (text) {
        return text;
      }
    }
  }
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((ref) => {
        const node = element.ownerDocument.getElementById(ref);
        return node instanceof HTMLElement ? textWithoutControls(node) : '';
      })
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ');
    }
  }
  const aria = element.getAttribute('aria-label');
  if (aria) {
    return aria.trim();
  }
  return '';
}

function describedByText(element: HTMLElement): string {
  const describedBy = element.getAttribute('aria-describedby');
  if (!describedBy) {
    return '';
  }
  return describedBy
    .split(/\s+/)
    .map((ref) => {
      const node = element.ownerDocument.getElementById(ref);
      return node instanceof HTMLElement ? textWithoutControls(node) : '';
    })
    .filter(Boolean)
    .join(' ');
}

function previousMeaningfulText(element: HTMLElement): string {
  let node: ChildNode | null = element.previousSibling;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, ' ').trim();
      if (text && text.length < 200) {
        return text;
      }
    }
    if (node instanceof HTMLElement) {
      if (node.matches('input, textarea, select, button, label')) {
        break;
      }
      const text = textWithoutControls(node);
      if (text && text.length < 200) {
        return text;
      }
    }
    node = node.previousSibling;
  }
  return '';
}

function nearestExclusiveGroup(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element.parentElement;
  while (current && current !== element.ownerDocument.body) {
    if (current.tagName === 'FORM' || current.tagName === 'MAIN') {
      return null;
    }
    const controls = current.querySelectorAll(CONTROL_SELECTOR);
    if (controls.length > 1) {
      if (current.tagName === 'LABEL' && current.contains(element) && controls[0] === element) {
        return current;
      }
      return null;
    }
    if (controls.length === 1 && controls[0] === element) {
      const caption = textWithoutControls(current);
      if (
        caption.length > 0 &&
        caption.length <= 280 &&
        (current.matches(FIELD_GROUP_SELECTOR) || current.tagName === 'DIV' || current.tagName === 'SPAN')
      ) {
        return current;
      }
    }
    current = current.parentElement;
  }
  return null;
}

function groupCaption(group: HTMLElement, element: HTMLElement): string {
  const legend = group.querySelector('legend, h2, h3, h4, .label');
  if (legend instanceof HTMLElement && !legend.contains(element)) {
    const text = textWithoutControls(legend);
    if (text && text.length < 200) {
      return text;
    }
  }
  const label = group.querySelector('label');
  if (label instanceof HTMLElement) {
    const htmlFor = label.getAttribute('for');
    if (!htmlFor || htmlFor === element.id) {
      const text = textWithoutControls(label);
      if (text && text.length < 200) {
        return text;
      }
    }
  }
  const text = textWithoutControls(group);
  if (text && text.length > 0 && text.length <= 200) {
    return text;
  }
  return '';
}

function labelFor(element: HTMLElement): string {
  const associated = associatedLabelText(element);
  if (associated) {
    return associated;
  }
  const described = describedByText(element);
  if (described) {
    return described;
  }
  const prev = previousMeaningfulText(element);
  if (prev) {
    return prev;
  }
  const group = nearestExclusiveGroup(element);
  if (group) {
    const caption = groupCaption(group, element);
    if (caption) {
      return caption;
    }
  }
  return (element.getAttribute('placeholder') ?? element.getAttribute('name') ?? '').trim();
}

function surroundingText(element: HTMLElement): string {
  const bits = [
    associatedLabelText(element),
    describedByText(element),
    element.getAttribute('placeholder') ?? '',
    element.getAttribute('name') ?? '',
    element.getAttribute('id') ?? '',
    previousMeaningfulText(element),
  ];
  const group = nearestExclusiveGroup(element);
  if (group) {
    bits.push(groupCaption(group, element));
  }
  return bits
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const seenElements = new Set<HTMLElement>();

  nodes.forEach((element, index) => {
    if (!(element instanceof HTMLElement) || seenElements.has(element)) {
      return;
    }
    seenElements.add(element);
    const kind = kindFromControl(element);
    if (!kind) {
      return;
    }
    if (!isVisible(element) || Boolean(element.disabled)) {
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
      if (isVisible(byId) && !byId.disabled) {
        return byId;
      }
    }
  }
  if (field.selectorHint.startsWith('#') || field.selectorHint.startsWith('[')) {
    try {
      const hinted = scope.querySelector(field.selectorHint);
      if (hinted instanceof HTMLInputElement || hinted instanceof HTMLTextAreaElement) {
        if (!hinted.disabled && isVisible(hinted)) {
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
