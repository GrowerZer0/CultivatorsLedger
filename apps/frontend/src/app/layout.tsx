import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TelemetryProvider } from "@/lib/telemetry-context";

export const metadata: Metadata = {
  title: "Cultivator's Ledger",
  description: "Cultivation telemetry dashboard",
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden bg-[#f6f8f4] dark:bg-zinc-950">
      <body className="antialiased min-h-screen max-w-full overflow-x-hidden bg-[#f6f8f4] text-graphite dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TelemetryProvider>
            {children}
          </TelemetryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}