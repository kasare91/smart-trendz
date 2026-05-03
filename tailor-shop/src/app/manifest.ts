import type { MetadataRoute } from 'next';
import { getBusinessProfile, DEFAULT_BUSINESS_NAME } from '@/lib/business-profile';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const profile = await getBusinessProfile().catch(() => null);
  const name = profile?.businessName || DEFAULT_BUSINESS_NAME;

  return {
    name,
    short_name: name.length > 12 ? name.split(' ')[0] : name,
    description: 'Boutique and tailor shop order management system',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: profile?.brandColor || '#0ea5e9',
    orientation: 'portrait-primary',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'New Order',
        url: '/orders/new',
        description: 'Create a new order',
      },
      {
        name: 'Orders',
        url: '/orders',
        description: 'View all orders',
      },
      {
        name: 'Customers',
        url: '/customers',
        description: 'View all customers',
      },
    ],
  };
}
