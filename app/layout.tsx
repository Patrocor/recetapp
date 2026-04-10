import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-dm-serif",
});

export const metadata: Metadata = {
  title: "RecetAPP · Documentos Médicos Digitales · Perú",
  description: "Genera recetas médicas, órdenes de exámenes, constancias y certificados en PDF.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "RecetAPP", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#04313A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${dmSans.variable} ${dmSerif.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
