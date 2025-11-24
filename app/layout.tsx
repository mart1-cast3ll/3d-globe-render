import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D Globe",
  description: "An animated 3D globe with Three.js & Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>{children}</body>
    </html>
  );
}
