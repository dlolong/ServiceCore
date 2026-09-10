import type { Metadata } from "next";

import { clientEnv } from "@/lib/env/client";
import { productBrand } from "@/modules/platform/brand";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_APP_URL),
  title: { default: `${productBrand.name} | Business Operating System`, template: `%s | ${productBrand.name}` },
  description: productBrand.description,
  applicationName: productBrand.name,
  icons: {
    icon: { url: "/images/NegOSu_favicon.png", type: "image/png" },
  },
  keywords: ["business operating system", "automotive business software", "salon management software", "appointment scheduling", "inventory management"],
  openGraph: {
    siteName: productBrand.name,
    title: `${productBrand.name} | Business Operating System`,
    description: productBrand.description,
    type: "website",
  },
  twitter: { card: "summary", title: `${productBrand.name} | Business Operating System`, description: productBrand.description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
