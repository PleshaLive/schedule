import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { inter } from "./fonts";

export const metadata: Metadata = {
  title: "Fixture Fusion",
  description: "Unified calendar for Manchester United, Leeds United, and UFC events.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${inter.variable} min-h-screen antialiased`}
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#000000] via-[#0a0a0a] to-[#000000]">
          {/* Animated gradient orbs */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[10%] top-[5%] h-[600px] w-[600px] animate-pulse rounded-full bg-gradient-radial from-black/40 via-black/10 to-transparent blur-3xl" />
            <div className="absolute right-[15%] top-[20%] h-[500px] w-[500px] animate-pulse rounded-full bg-gradient-radial from-gray-900/30 via-gray-900/5 to-transparent blur-3xl delay-1000" />
            <div className="absolute bottom-[10%] left-[40%] h-[550px] w-[550px] animate-pulse rounded-full bg-gradient-radial from-black/25 via-black/5 to-transparent blur-3xl delay-2000" />
          </div>

          {/* Grid overlay */}
          <div 
            className="pointer-events-none absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(100, 100, 100, 0.4) 1px, transparent 1px),
                linear-gradient(90deg, rgba(100, 100, 100, 0.4) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px'
            }}
          />

          {/* Noise texture */}
          <div 
            className="pointer-events-none absolute inset-0 opacity-[0.015] mix-blend-soft-light"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
            }}
          />

          {/* Content */}
          <div className="relative z-10">{children}</div>
        </div>
      </body>
    </html>
  );
}
