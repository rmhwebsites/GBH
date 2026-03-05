import type { Metadata, Viewport } from "next";
import { MemberstackProvider } from "@/components/providers/MemberstackProvider";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#000d1a",
};

export const metadata: Metadata = {
  title: "GBH Capital | Dashboard",
  description: "Member investment dashboard for GBH Capital",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GBH Capital",
  },
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <MemberstackProvider>{children}</MemberstackProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
