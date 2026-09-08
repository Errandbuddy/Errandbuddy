import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Errandbuddy — Find trusted local artisans, paid safely on Stellar",
  description:
    "Book verified plumbers, electricians, cleaners and other artisans near you. Payments are held in a Stellar escrow until the job is done."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto min-h-[calc(100vh-64px)] max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-ink/10 py-8 text-center text-sm text-ink/50">
          Errandbuddy — an open-source MVP built on Stellar. See CONTRIBUTING.md in the repo to get involved.
        </footer>
      </body>
    </html>
  );
}
