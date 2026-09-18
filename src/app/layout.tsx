import type { Metadata } from "next";
import "./globals.css";
import { Header, Footer } from "@/components/brand";
export const metadata: Metadata = {
  title: {
    default: "VSP Connect — Intelligent products. Human connections.",
    template: "%s | VSP Connect",
  },
  description:
    "Meet the people building AI solutions and intelligent products at VSP Innovations.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="site-shell">
          <Header />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
