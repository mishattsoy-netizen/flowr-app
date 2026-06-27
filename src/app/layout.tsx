import { Literata, DM_Sans, DM_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import SupabaseProvider from "@/components/SupabaseProvider";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import FadeTextObserver from "@/components/ui/FadeTextObserver"
import WelcomeTransition from "@/components/WelcomeTransition";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";

const literata = Literata({
  variable: "--font-display",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: "Flowr",
  description: "Visual-first productivity and knowledge workspace",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${literata.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased preload`}
    >
      <head suppressHydrationWarning>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                const str = localStorage.getItem('flowr-storage');
                if (str) {
                  const state = JSON.parse(str).state;
                  if (state) {
                    if (state.isSidebarCollapsed) {
                      document.documentElement.style.setProperty('--sidebar-w', '0px');
                    } else if (state.sidebarWidth != null) {
                      document.documentElement.style.setProperty('--sidebar-w', state.sidebarWidth + 'px');
                    }
                    if (state.isFullWidth === false) {
                      document.documentElement.style.setProperty('--dashboard-max-w', '1200px');
                    } else {
                      document.documentElement.style.setProperty('--dashboard-max-w', 'none');
                    }

                    if (state.activeEntityId) {
                      document.documentElement.setAttribute('data-initial-entity', state.activeEntityId);
                      document.cookie = "flowr-initial-entity=" + state.activeEntityId + "; path=/; max-age=31536000; SameSite=Lax";
                    }
                  }
                }
              } catch (e) {}
            })();`
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>
            <SupabaseProvider>
              {children}
              <FadeTextObserver />
              <WelcomeTransition />
              <Analytics />
              <SpeedInsights />
              <ServiceWorkerRegistrar />
            </SupabaseProvider>
          </AuthProvider>
        </ThemeProvider>
        <script
          suppressHydrationWarning
          src="https://js.puter.com/v2/"
          async
          defer
        />
      </body>
    </html>
  );
}
