import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Lora } from "next/font/google";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const title = "Not Just You";
const description =
  "Check real-time community reports for AI tools and report Slow, Error, or Down without signing in.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: title,
  title: {
    default: title,
    template: `%s | ${title}`,
  },
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: title,
    type: "website",
    locale: "en_US",
  },
  robots: {
    index: true,
    follow: true,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={lora.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
