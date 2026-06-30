import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BCP — Bank Compliance Platform',
  description: 'Regulatory compliance gap analysis',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
