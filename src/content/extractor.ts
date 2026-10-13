import { normalizeLabel } from '../data/fieldAliases';
import type { ExtractedField, FillableControlKind } from '../types';

const CONTROL_SELECTOR = 'input, textarea, select';

function isVisible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) {
    return true;
  }
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  return true;
}

function kindFromControl(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): FillableControlKind | null {
  if (element instanceof HTMLTextAreaElement) {
    return 'textarea';
  }
  if (element instanceof HTMLSelectElement) {
    return null;
  }
  const type = (element.type || 'text').toLowerCase();
  if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset' || type === 'image' || type === 'password') {
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

function surroundingText(element: HTMLElement): string {
  const group = element.closest('fieldset, section, form, .field, .form-field, li, div');
  const bits = [
    element.getAttribute('placeholder') ?? '',
    element.getAttribute('name') ?? '',
    element.getAttribute('id') ?? '',
    group?.querySelector('legend, h2, h3, h4')?.textContent ?? '',
    group?.textContent?.slice(0, 240) ?? '',
  ];
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
    return `#${element.id}`;
  }
  const name = element.getAttribute('name');
  if (name) {
    return `[name="${name}"]`;
  }
  return `${element.tagName.toLowerCase()}:nth-of-type-like(${index})`;
}

export function extractVisibleFields(root: ParentNode): ExtractedField[] {
  const nodes = Array.from((root as Document | Element).querySelectorAll(CONTROL_SELECTOR)) as Array<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >;
  const fields: ExtractedField[] = [];

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
      normalized.includes('how can we help') ||
      normalized === 'search' ||
      normalized.includes('search help') ||
      normalized.includes('search for help')
    ) {
      return;
    }
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    fields.push({
      id: element.id || element.getAttribute('name') || `field-${index}`,
      label,
      normalizedLabel: normalizeLabel(label),
      name: element.getAttribute('name') ?? '',
      type: element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase(),
      kind,
      required: element.hasAttribute('required'),
      disabled: Boolean(element.disabled),
      visible: true,
      currentValue: currentValue(input),
      checked: element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')
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
  if (field.id) {
    const byId = scope.querySelector(`#${cssEscape(field.id)}`);
    if (byId instanceof HTMLInputElement || byId instanceof HTMLTextAreaElement) {
      return byId;
    }
  }
  if (field.name) {
    const byName = scope.querySelector(`[name="${cssEscape(field.name)}"]`);
    if (byName instanceof HTMLInputElement || byName instanceof HTMLTextAreaElement) {
      return byName;
    }
  }
  const candidates = Array.from(scope.querySelectorAll(CONTROL_SELECTOR)) as Array<
    HTMLInputElement | HTMLTextAreaElement
  >;
  return (
    candidates.find((candidate) => {
      const label = labelFor(candidate);
      return normalizeLabel(label) === field.normalizedLabel && !candidate.disabled;
    }) ?? null
  );
}
