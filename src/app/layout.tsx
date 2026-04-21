import Script from "next/script";
import { Crimson_Pro, DM_Sans, DM_Mono } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import SupabaseProvider from "@/components/SupabaseProvider";

const crimsonPro = Crimson_Pro({
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
      className={`${crimsonPro.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased preload`}
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
