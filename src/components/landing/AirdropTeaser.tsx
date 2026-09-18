'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const NOTES = [
  { text: 'heard FCFS spots drop before he fully wakes', tag: '#rumor', rotate: '-2.5deg' },
  { text: 'guaranteed mint = you + your circle. not solo', tag: '#confirmed', rotate: '1.5deg' },
  { text: '$NYX utility TBD but the art alone is worth it', tag: '#alpha', rotate: '-1deg' },
  { text: 'airdrop for early dreamers: wallet must be verified', tag: '#official', rotate: '2deg' },
  { text: "referrals multiply your points. don't sleep on this", tag: '#tip', rotate: '-1.8deg' },
  { text: "meter hits 100% → Nyx opens his eyes. that's the launch", tag: '#lore', rotate: '1.2deg' },
];

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export default function AirdropTeaser() {
  const { ref, inView } = useInView();
  const [dotOn, setDotOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setDotOn(v => !v), 800);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="land-airdrop" id="airdrop" aria-labelledby="airdrop-heading" ref={ref}>
      <div className="wrap">
        <div className="land-airdrop-header">
          <div className="land-ticker" aria-label="Live: Airdrop active">
            <span className="land-ticker-dot" style={{ opacity: dotOn ? 1 : 0.2 }} aria-hidden="true" />
            <span>$NYX · Airdrop rumours</span>
          </div>
          <p className="land-kicker" style={{ marginTop: 20 }}>$NYX</p>
          <h2 id="airdrop-heading" className="land-section-title">
            The dream world has its own currency.
          </h2>
          <p className="land-section-sub" style={{ maxWidth: 540, margin: '0 auto' }}>
            Notes pinned to the corkboard. Unconfirmed. Passed between dreamers.
            The only way to know for sure is to be there when he wakes.
          </p>
        </div>

        {/* Cork board */}
        <div className="land-cork">
          <div className="land-cork-grid">
            {NOTES.map((note, i) => (
              <div
                key={i}
                className={`land-note ${inView ? 'land-note--visible' : ''}`}
                style={{
                  transform: `rotate(${note.rotate})`,
                  transitionDelay: `${i * 0.1}s`,
                }}
              >
                <div className="land-note-pin" aria-hidden="true" />
                <p>{note.text}</p>
                <span className="land-note-tag">{note.tag}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="land-airdrop-cta">
          <Link href="/dashboard" className="land-cta-btn land-cta-btn--large" id="land-airdrop-enter">
            <span className="land-cta-btn-text">Join the circle</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <p className="land-airdrop-footnote">
            Free to enter. Requires a Solana wallet and proof you showed up.
          </p>
        </div>
      </div>
    </section>
  );
}
