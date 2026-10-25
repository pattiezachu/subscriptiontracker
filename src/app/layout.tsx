import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Subscription Tracker",
  description: "Private tracker for subscriptions and recurring tasks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
