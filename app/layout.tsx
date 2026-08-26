import type { Metadata } from "next";

import { clientEnv } from "@/lib/env/client";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_APP_URL),
  title: { default: "KarKR", template: "%s | KarKR" },
  description: "Smart software for car wash, detailing and auto service businesses.",
  applicationName: "KarKR",
  keywords: ["car wash software", "auto service software", "Philippines"],
  openGraph: {
    title: "KarKR — Your Car. Our Care.",
    description: "Smart software for car wash, detailing and auto service businesses.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
