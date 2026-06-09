import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkedIn Calendar — LATAM",
  description: "Calendario de publicaciones LinkedIn para equipos de contenido en LATAM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={GeistSans.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
