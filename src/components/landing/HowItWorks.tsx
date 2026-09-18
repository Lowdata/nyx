'use client';

import { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    no: '01',
    icon: '⬡',
    title: 'Connect Wallet',
    body: "Sign with your EVM wallet. One signature, no gas, no friction. This is how the dream knows you're real.",
    color: 'var(--violet)',
  },
  {
    no: '02',
    icon: '✶',
    title: 'Post on X',
    body: "Tweet about Nyx. The community's voice is part of the ritual: every post adds weight to the circle.",
    color: 'var(--gold)',
  },
  {
    no: '03',
    icon: '⌇',
    title: 'Invite Friends',
    body: "Referrals multiply points. The meter climbs collectively, not alone: that's the whole point of the dream.",
    color: 'var(--gold-deep)',
  },
  {
    no: '04',
    icon: '✦',
    title: 'Claim Your Spot',
    body: 'FCFS slots, Guaranteed spots: what you unlock depends on how far the whole circle gets before he wakes.',
    color: '#10b981',
  },
];

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
}

export default function HowItWorks() {
  const { ref, inView } = useInView();

  return (
    <section className="land-process" id="process" aria-labelledby="process-heading" ref={ref}>
      <div className="wrap">
        <p className="land-kicker">How it works</p>
        <h2 id="process-heading" className="land-section-title">
          The ritual has four steps.
        </h2>
        <p className="land-section-sub">
          A collective act. Not a lottery, not a gamble: a circle that proves itself.
        </p>

        <div className="land-process-grid">
          {STEPS.map((step, i) => (
            <div
              key={step.no}
              className={`land-entry ${inView ? 'land-entry--visible' : ''}`}
              style={{ transitionDelay: `${i * 0.12}s` }}
            >
              <div className="land-entry-no">{step.no}</div>
              <div className="land-entry-icon" style={{ color: step.color }} aria-hidden="true">
                {step.icon}
              </div>
              <h3 className="land-entry-title">{step.title}</h3>
              <p className="land-entry-body">{step.body}</p>
              {/* ruled lines for notebook feel */}
              <div className="land-entry-lines" aria-hidden="true">
                <span /><span /><span />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
