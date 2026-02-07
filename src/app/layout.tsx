import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NativeAppListener from "@/components/NativeAppListener";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Centjes - Boekhouding. Simpel.",
  description: "De moderne boekhoudtool voor ZZP'ers en VOF's.",
  icons: {
    icon: "/Favicon dark blue.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Centjes",
  },
};

export const viewport = {
  colorScheme: "dark" as const,
  viewportFit: "cover" as const,
  themeColor: "#0071e3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        style={{ minHeight: "100vh" }}
      >
        <NativeAppListener />
        {children}
      </body>
    </html>
  );
}
