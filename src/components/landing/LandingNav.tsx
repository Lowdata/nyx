'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`land-nav ${scrolled ? 'land-nav--scrolled' : ''}`} aria-label="Landing navigation">
      <div className="wrap land-nav-inner">
        <Link href="/" className="land-nav-brand" aria-label="Nyx - Home">
          <img
            src="/nyxlogo.webp"
            alt="Nyx Logo"
            width="105"
            height="42"
            style={{ height: '42px', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </Link>

        {/* Desktop links */}
        <div className="land-nav-links" aria-hidden={menuOpen}>
          <Link href="/">Home</Link>
          <a href="#world">The World</a>
          <a href="#process">How it works</a>
          <a href="#airdrop">$NYX</a>
        </div>

        <div className="land-nav-actions">
          {/* X / Twitter */}
          <a
            href="https://x.com/enternyx"
            target="_blank"
            rel="noopener noreferrer"
            className="land-nav-icon-btn"
            aria-label="Follow @enternyx on X"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          <Link href="/dashboard" className="land-nav-cta" id="land-enter-dashboard">
            Enter the Dream
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Mobile hamburger */}
          <button
            className={`land-nav-hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(p => !p)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="land-nav-mobile" role="dialog" aria-label="Mobile navigation">
          <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <a href="#world" onClick={() => setMenuOpen(false)}>The World</a>
          <a href="#process" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#airdrop" onClick={() => setMenuOpen(false)}>$NYX</a>
          <Link href="/dashboard" className="land-nav-cta land-nav-cta--full" onClick={() => setMenuOpen(false)}>
            Enter the Dream →
          </Link>
        </div>
      )}
    </nav>
  );
}
