'use client';

import Image from 'next/image';
import { DEFAULT_BUSINESS_NAME, getBusinessInitials } from '@/lib/business-profile';

type BusinessLogoProps = {
  businessName?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  size?: 'sm' | 'md' | 'lg';
};

const sizes = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-16 h-16 text-xl',
};

export default function BusinessLogo({
  businessName = DEFAULT_BUSINESS_NAME,
  logoUrl,
  brandColor,
  size = 'md',
}: BusinessLogoProps) {
  const className = `${sizes[size]} rounded-lg flex items-center justify-center shadow-sm overflow-hidden text-white font-bold`;

  if (logoUrl) {
    return (
      <div className={`${sizes[size]} rounded-lg overflow-hidden border border-gray-200 bg-white`}>
        <Image src={logoUrl} alt={`${businessName} logo`} width={64} height={64} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={className} style={{ backgroundColor: brandColor || '#0ea5e9' }}>
      {getBusinessInitials(businessName)}
    </div>
  );
}
