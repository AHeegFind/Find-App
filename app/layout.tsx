import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "FIND — See something you love? Find it.",
  description: "Visual product search for Kenya.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300..900;0,9..144,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
