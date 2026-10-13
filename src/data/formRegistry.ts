import type { DomainAllowlistEntry, FormRegistry, FormSignature } from '../types';

export const APPROVED_HOSTS: DomainAllowlistEntry[] = [
  { hostname: 'www.facebook.com', pathPrefixes: ['/help/contact'] },
  { hostname: 'facebook.com', pathPrefixes: ['/help/contact'] },
  { hostname: 'm.facebook.com', pathPrefixes: ['/help/contact'] },
  { hostname: 'business.facebook.com', pathPrefixes: ['/help/contact'] },
  { hostname: 'www.instagram.com', pathPrefixes: ['/help/contact'] },
  { hostname: 'instagram.com', pathPrefixes: ['/help/contact'] },
  { hostname: 'help.instagram.com', pathPrefixes: ['/contact'] },
  { hostname: 'www.meta.com', pathPrefixes: ['/help/contact'] },
  { hostname: 'meta.com', pathPrefixes: ['/help/contact'] },
];

export const LOCAL_DEV_HOSTS = ['localhost', '127.0.0.1'];

export const TRADEMARK_APPEAL_SIGNATURE: FormSignature = {
  id: 'meta-trademark-appeal-contact',
  displayName: 'Meta Trademark Appeal Contact Form',
  requiredHostAllowlist: true,
  minMatchedSignatures: 4,
  headingPatterns: [
    'contact information',
    'reported content at issue',
    'appeal explanation',
    'declaration',
    'electronic signature',
    'trademark',
    'intellectual property',
  ],
  labelPatterns: [
    'full name',
    'your name (name and surname)',
    'official organization',
    'official online presence',
    'facebook page',
    'email address',
    'contact email',
    'report number',
    'please explain why you believe that the content should not have been removed',
    'appeal explanation',
    'electronic signature',
    'removed content',
    'url(s)/description',
  ],
  forbiddenPatterns: [
    'messenger conversation',
    'news feed',
    'create post',
    'stories archive',
  ],
};

export const FORM_REGISTRY: FormRegistry = {
  allowlist: APPROVED_HOSTS,
  signatures: [TRADEMARK_APPEAL_SIGNATURE],
  localDevHosts: LOCAL_DEV_HOSTS,
};

export function hostnameMatchesAllowlist(
  hostname: string,
  pathname: string,
  registry: FormRegistry = FORM_REGISTRY,
): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (registry.localDevHosts.includes(host)) {
    return true;
  }
  return registry.allowlist.some((entry) => {
    if (entry.hostname !== host) {
      return false;
    }
    return entry.pathPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix),
    );
  });
}
