import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';

import { ThemeToggle } from '@/components/molecules/ThemeToggle';
import { AuthStatus } from '@/components/molecules/AuthStatus';
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
          <header className='flex items-center justify-between gap-3 border-b border-border px-6 py-4'>
            <span className='shrink-0 font-display text-lg font-bold text-primary'>
              CineTicket
            </span>
            <div className='flex min-w-0 items-center gap-2 sm:gap-4'>
              <AuthStatus />
              <ThemeToggle />
            </div>
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
