import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';

import { ThemeToggle } from '@/components/molecules/ThemeToggle';
import { Providers } from '@/lib/providers';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'CineTicket',
  description:
    'Reserva de ingressos de cinema com mapa de assentos em tempo real.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='pt-BR' suppressHydrationWarning>
      <body
        className={`${inter.variable} ${poppins.variable} font-sans antialiased`}
      >
        <Providers>
          <header className='flex items-center justify-between border-b border-border px-6 py-4'>
            <span className='font-display text-lg font-bold text-primary'>
              CineTicket
            </span>
            <ThemeToggle />
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
