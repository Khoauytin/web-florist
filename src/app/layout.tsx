import type { Viewport } from "next";
import { Be_Vietnam_Pro, Fraunces } from "next/font/google";

const body = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

/** Display face of the existing public catalog (kept as the shop's brand type). */
const display = Fraunces({
  subsets: ["latin", "vietnamese"],
  axes: ["SOFT", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
