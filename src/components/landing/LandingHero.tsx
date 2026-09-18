'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const WORDS = ['Wake', 'the', 'God', 'of', 'Sleep.'];

export default function LandingHero() {
  const [visibleWords, setVisibleWords] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [subVisible, setSubVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    // Stagger words in
    WORDS.forEach((_, i) => {
      setTimeout(() => {
        setVisibleWords(i + 1);
        if (i === WORDS.length - 1) {
          setTimeout(() => setSubVisible(true), 300);
          setTimeout(() => setCtaVisible(true), 700);
        }
      }, 300 + i * 160);
    });
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const parallaxShift = Math.min(80, scrollY * 0.12);

  return (
    <section className="land-hero" id="top" aria-label="Hero">
      {/* Full-bleed artwork */}
      <div className="land-hero-bg" style={{ transform: `translateY(${parallaxShift}px)` }}>
        <Image
          src="/main.webp"
          alt="Nyx, the God of Sleep, dreaming on clouds beneath a giant moon"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center top' }}
        />
      </div>

      {/* Layered gradient scrims */}
      <div className="land-hero-scrim land-hero-scrim--bottom" aria-hidden="true" />
      <div className="land-hero-scrim land-hero-scrim--left" aria-hidden="true" />

      {/* Animated moon glow orb */}
      <div className="land-hero-moonglow" aria-hidden="true" />

      {/* Content */}
      <div className="land-hero-content wrap">
        <p className="land-hero-eyebrow" aria-label="Status: Deep Asleep">
          <span className="land-live-dot" aria-hidden="true" />
          DEEP ASLEEP · PHASE 1
        </p>

        <h1 className="land-hero-title" aria-label="Wake the God of Sleep.">
          {WORDS.map((word, i) => (
            <span
              key={word + i}
              className={`land-hero-word ${i < visibleWords ? 'visible' : ''}`}
              style={{ transitionDelay: `${i * 0.04}s` }}
            >
              {word}
            </span>
          ))}
        </h1>

        <p className={`land-hero-sub ${subVisible ? 'visible' : ''}`}>
          He wakes when the circle proves itself real — one wallet, one post,
          one dream at a time.
        </p>

        <div className={`land-hero-actions ${ctaVisible ? 'visible' : ''}`}>
          <Link href="/dashboard" className="land-cta-btn" id="land-hero-enter">
            <span className="land-cta-btn-text">Enter the Dream</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a href="#world" className="land-ghost-btn">
            Discover the myth
          </a>
        </div>

        {/* Floating stat pills */}
        <div className={`land-hero-stats ${ctaVisible ? 'visible' : ''}`}>
          <div className="land-stat-pill">
            <span className="land-stat-icon">🌑</span>
            <span>Community-driven</span>
          </div>
          <div className="land-stat-pill">
            <span className="land-stat-icon">✦</span>
            <span>On-chain dream</span>
          </div>
          <div className="land-stat-pill">
            <span className="land-stat-icon">🎞️</span>
            <span>Web3 collectibles</span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="land-scroll-hint" aria-hidden="true">
        <div className="land-scroll-line" />
        <span>scroll</span>
      </div>
    </section>
  );
}
