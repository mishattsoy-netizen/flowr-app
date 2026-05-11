import Script from "next/script";
import { Crimson_Text, DM_Sans, DM_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import SupabaseProvider from "@/components/SupabaseProvider";

const crimsonText = Crimson_Text({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Flowr",
  description: "Visual-first productivity and knowledge workspace",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
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
      className={`${crimsonText.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased preload`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SupabaseProvider>
          {children}
        </SupabaseProvider>
        <Script id="remove-preload" strategy="afterInteractive">
          {`document.documentElement.classList.remove('preload');`}
        </Script>
        <Script
          src="https://js.puter.com/v2/"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
