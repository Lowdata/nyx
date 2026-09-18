'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

const SYMBOLS = [
  {
    icon: '🌑',
    title: 'The Moon',
    desc: 'Marks the phases of the dream. The cycle begins in darkness and ends in full light.',
  },
  {
    icon: '🎞️',
    title: 'The Camera',
    desc: "Dreams that go unrecorded fade. The camera preserves what the waking world can't hold.",
  },
  {
    icon: '🛹',
    title: 'The Skateboard',
    desc: 'Movement without destination. Nyx rides the in-between — neither asleep nor awake.',
  },
  {
    icon: '📜',
    title: 'The Scroll',
    desc: 'The rules he left behind. Four steps. One circle. No exceptions.',
  },
];

const FLYWHEEL = ['🌑 Sleep', '🌗 Stir', '✦ Wake', '🎞️ Dream'];

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

export default function WorldSection() {
  const { ref: textRef, inView: textIn } = useInView();
  const { ref: symbolsRef, inView: symbolsIn } = useInView();
  const { ref: wheelRef, inView: wheelIn } = useInView();
  const [activeNode, setActiveNode] = useState(0);

  useEffect(() => {
    if (!wheelIn) return;
    const id = setInterval(() => setActiveNode(n => (n + 1) % FLYWHEEL.length), 1400);
    return () => clearInterval(id);
  }, [wheelIn]);

  return (
    <section className="land-world" id="world" aria-labelledby="world-heading">
      <div className="wrap">

        {/* ---- Myth text + art ---- */}
        <div className="land-lore-grid" ref={textRef}>
          <div className={`land-lore-text ${textIn ? 'land-reveal' : ''}`}>
            <p className="land-kicker">The myth</p>
            <h2 id="world-heading" className="land-section-title">
              Before the dream,<br />there was Nyx.
            </h2>
            <p className="land-lore-body">
              Long before the first mint, Nyx ruled the space between waking and
              dreaming. Tired of the noise, he folded himself into sleep —
              skateboard tucked under one arm, camera at his side — and left the
              dream world quiet and unclaimed.
            </p>
            <p className="land-lore-body">
              He left one rule behind: he wakes only when a circle of dreamers
              proves itself real. Not by luck, and not by one person alone, but by
              many small, ordinary acts of showing up.
            </p>
            <p className="land-lore-body">
              That's the loop this collection runs on. Community actions fill the
              meter. The meter moves Nyx from sleep toward waking. And what you
              unlock depends on how far the whole circle gets — not just you.
            </p>
          </div>

          <div className={`land-lore-art ${textIn ? 'land-reveal' : ''}`} style={{ transitionDelay: '0.2s' }}>
            <div className="land-photo-frame">
              <div className="land-tape land-tape-tl" aria-hidden="true" />
              <div className="land-tape land-tape-tr" aria-hidden="true" />
              <Image
                src="/nyx_art.jpg"
                alt="Nyx character art"
                width={480}
                height={480}
                style={{ width: '100%', height: 'auto', display: 'block', filter: 'saturate(0.9)' }}
              />
              <p className="land-photo-cap">entry no. 001 · still half asleep</p>
            </div>
          </div>
        </div>

        {/* ---- Symbol cards ---- */}
        <div className="land-symbols-grid" ref={symbolsRef}>
          {SYMBOLS.map((s, i) => (
            <div
              key={s.title}
              className={`land-symbol-card ${symbolsIn ? 'land-reveal' : ''}`}
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              <span className="land-symbol-icon" aria-hidden="true">{s.icon}</span>
              <h4 className="land-symbol-title">{s.title}</h4>
              <p className="land-symbol-desc">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* ---- Flywheel ---- */}
        <div className="land-flywheel-wrap" ref={wheelRef} aria-label="The Nyx cycle: Sleep, Stir, Wake, Dream">
          <p className="land-kicker" style={{ textAlign: 'center', marginBottom: 32 }}>The cycle</p>
          <div className="land-flywheel">
            {FLYWHEEL.map((node, i) => (
              <div key={node} className="land-flywheel-item">
                <div className={`land-flywheel-node ${wheelIn && activeNode === i ? 'active' : ''} ${wheelIn && activeNode > i ? 'done' : ''}`}>
                  <span className="land-flywheel-emoji">{node.split(' ')[0]}</span>
                  <span className="land-flywheel-label">{node.split(' ').slice(1).join(' ')}</span>
                </div>
                {i < FLYWHEEL.length - 1 && (
                  <div className={`land-flywheel-arrow ${wheelIn && activeNode > i ? 'done' : ''}`} aria-hidden="true">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
