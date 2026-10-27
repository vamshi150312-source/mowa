import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const logo = Outfit({ weight: "700", subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Mova",
  description: "Share photos and videos with friends.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${logo.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
