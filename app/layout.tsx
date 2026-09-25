import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Daylight Tasks', description: 'A focused Singapore-timezone todo list' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-SG"><body>{children}</body></html>;
}
