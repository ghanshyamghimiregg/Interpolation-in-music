import type { Metadata } from 'next';
import { Source_Serif_4, JetBrains_Mono } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import DemoApp from '@/components/DemoApp';

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Interpolation in Music',
  description: 'Numerical methods demo — pitch interpolation made visible and audible',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${jetbrains.variable}`}>
      <body>
        <header className="site-header">
          <div className="header-inner">
            <div>
              <h1>Interpolation in Music</h1>
              <p className="tagline">
                Place notes on a pitch–time grid, pick an interpolation method, and hear the glide.
              </p>
            </div>
            <p className="credit-block">
              Ghanshyam Ghimire · BTech AI, 4th Sem · Kathmandu University
              <br />
              Course project for Sandesh Thakuri
            </p>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <p>
            Interpolation in Music — a numerical methods demo
            <br />
            Ghanshyam Ghimire · BTech AI, 4th Semester · Kathmandu University
            <br />
            Course project for Sandesh Thakuri
            <br />
            Source:{' '}
            <a
              href="https://github.com/ghanshyamghimiregg/Interpolation-in-music"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/ghanshyamghimiregg/Interpolation-in-music
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
