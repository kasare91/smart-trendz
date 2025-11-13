import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    branchId: string | null;
    branchName: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      branchId: string | null;
      branchName: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    branchId: string | null;
    branchName: string | null;
  }
}
