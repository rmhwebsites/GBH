import type { Metadata } from "next";
import { MemberstackProvider } from "@/components/providers/MemberstackProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "GBH Capital | Dashboard",
  description: "Member investment dashboard for GBH Capital",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
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
      </body>
    </html>
  );
}
