import { prisma } from './prisma';
import { NotFoundError, ValidationError } from './errors';

export const DEFAULT_BUSINESS_NAME = 'Tailor Desk';
export const DEFAULT_INVOICE_PREFIX = 'ORD';

export type BusinessProfileInput = {
  businessName?: string;
  businessType?: string;
  ownerName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  currency?: string | null;
  logoUrl?: string | null;
  logoPath?: string | null;
  brandColor?: string | null;
  receiptFooterNote?: string | null;
  invoicePrefix?: string | null;
};

export async function getBusinessProfile(tenantId?: string | null) {
  return prisma.businessProfile.findFirst({
    where: {
      active: true,
      ...(tenantId ? { tenantId } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function requireBusinessProfile() {
  const profile = await getBusinessProfile();
  if (!profile) {
    throw new NotFoundError('Business profile has not been set up');
  }
  return profile;
}

export function sanitizeBusinessProfileInput(input: BusinessProfileInput, requireName = true) {
  const businessName = input.businessName?.trim();

  if (requireName && !businessName) {
    throw new ValidationError('Business name is required');
  }

  const email = optionalString(input.email)?.toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Email address is invalid');
  }

  const phoneNumber = optionalString(input.phoneNumber);
  if (phoneNumber && !/^[+()\d\s-]{7,24}$/.test(phoneNumber)) {
    throw new ValidationError('Phone number is invalid');
  }

  const brandColor = optionalString(input.brandColor);
  if (brandColor && !/^#[0-9A-Fa-f]{6}$/.test(brandColor)) {
    throw new ValidationError('Brand color must be a hex color such as #0ea5e9');
  }

  const currency = optionalString(input.currency)?.toUpperCase() || 'GHS';
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ValidationError('Currency must be a 3-letter ISO code');
  }

  const invoicePrefix = sanitizeInvoicePrefix(input.invoicePrefix);

  return {
    ...(businessName !== undefined && { businessName }),
    businessType: optionalString(input.businessType) || 'Tailor Shop',
    ownerName: optionalString(input.ownerName),
    phoneNumber,
    email,
    address: optionalString(input.address),
    city: optionalString(input.city),
    country: optionalString(input.country),
    currency,
    logoUrl: optionalString(input.logoUrl),
    logoPath: optionalString(input.logoPath),
    brandColor,
    receiptFooterNote: optionalString(input.receiptFooterNote),
    invoicePrefix,
  };
}

export function sanitizeInvoicePrefix(value?: string | null) {
  const sanitized = (value || DEFAULT_INVOICE_PREFIX)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);

  return sanitized || DEFAULT_INVOICE_PREFIX;
}

export function getBusinessInitials(name?: string | null) {
  const value = name || DEFAULT_BUSINESS_NAME;
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function optionalString(value?: string | null) {
  if (value === undefined) return undefined;
  const trimmed = value?.trim();
  return trimmed || null;
}
