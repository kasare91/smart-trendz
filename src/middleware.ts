export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/',
    '/orders/:path*',
    '/customers/:path*',
    '/payments/:path*',
    '/analytics/:path*',
  ],
};
