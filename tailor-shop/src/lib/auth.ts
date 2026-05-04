import { getServerSession } from 'next-auth';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { UnauthorizedError, ForbiddenError, ValidationError } from './errors';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!user) {
          throw new Error('Invalid email or password');
        }

        if (!user.active) {
          throw new Error('Account is inactive. Please contact an administrator.');
        }

        if (!user.emailVerified) {
          throw new Error('Please verify your email address before logging in.');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Invalid email or password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
          branchName: user.branch?.name ?? null,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.branchId = user.branchId;
        token.branchName = user.branchName;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.branchId = token.branchId as string | null;
        session.user.branchName = token.branchName as string | null;
        session.user.tenantId = token.tenantId as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export async function requireRole(allowedRoles: string[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }
  return user;
}

// For models with a direct tenantId field: User, Branch, BusinessProfile.
// SUPER_ADMIN gets an empty filter (unrestricted). All other roles filter by their tenant.
export function getTenantFilter(
  session: import('next-auth').Session
): Record<string, unknown> {
  if (session.user.role === 'SUPER_ADMIN') return {};
  // tenantId is always non-null for non-SUPER_ADMIN users
  return { tenantId: session.user.tenantId! };
}

// For models scoped via Branch: Customer, Order, Payment, ActivityLog.
// ADMIN sees all branches in their tenant; STAFF/VIEWER see only their branch.
export function getTenantBranchFilter(
  session: import('next-auth').Session
): Record<string, unknown> {
  if (session.user.role === 'SUPER_ADMIN') return {};
  if (session.user.role === 'ADMIN') {
    return { branch: { tenantId: session.user.tenantId! } };
  }
  if (!session.user.branchId) {
    throw new ValidationError('User is not assigned to a branch');
  }
  return { branchId: session.user.branchId };
}
