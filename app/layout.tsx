import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Provider from "./provider";
import { ConditionalAuthProvider } from "./conditional-auth-provider";
import { SplashScreen } from "@/components/splash-screen";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Cascadia Ops — Forestry Operations Platform",
  description:
    "Forestry operations management for Cascadia Forestry Inc and Ramos Reforestation Inc",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <SplashScreen>
          <ConditionalAuthProvider>
            <Provider>
              <DemoModeBanner />
              {children}
              <Toaster />
            </Provider>
          </ConditionalAuthProvider>
        </SplashScreen>
        <Analytics />
      </body>
    </html>
  );
}
