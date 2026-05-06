import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import SessionProvider from "@/components/SessionProvider";
import ThemeProvider from "@/components/ThemeProvider";
import OfflineIndicator from "@/components/OfflineIndicator";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import SetupGate from "@/components/SetupGate";
import BusinessTitle from "@/components/BusinessTitle";
import { getBusinessProfile, DEFAULT_BUSINESS_NAME } from "@/lib/business-profile";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `${DEFAULT_BUSINESS_NAME} Manager`,
  description: "Manage customer orders, payments, reminders, and reports for a boutique or tailor shop",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: DEFAULT_BUSINESS_NAME,
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const businessProfile = await getBusinessProfile();

  return (
    <html lang="en" className="h-full">
      <head />
      <body className={`${inter.className} h-full`}>
        <ThemeProvider>
          <SessionProvider>
            <BusinessTitle businessName={businessProfile?.businessName} />
            <SetupGate />
            <div className="flex h-full bg-gray-50 dark:bg-gray-900">
              <Navigation businessProfile={businessProfile} />
              <div className="flex-1 flex flex-col min-h-full md:ml-60">
                {/* Spacer for mobile top bar */}
                <div className="h-14 md:hidden" />
                <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
                  {children}
                </main>
              </div>
            </div>
            <OfflineIndicator />
            <ServiceWorkerRegistration />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
