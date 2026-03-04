import type { Metadata } from "next";
import { MemberstackProvider } from "@/components/providers/MemberstackProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "GBH Capital | Dashboard",
  description: "Member investment dashboard for GBH Capital",
  icons: {
    icon: "/logo.avif",
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
