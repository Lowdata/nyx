'use client';

export default function Lore() {
  return (
    <section className="lore" id="lore" aria-labelledby="lore-heading">
      <div className="wrap lore-grid">
        <div className="lore-text">
          <p className="kicker">The myth</p>
          <h2 id="lore-heading" style={{ marginBottom: 18 }}>
            Before the dream, there was Nyx.
          </h2>
          <p>
            Long before the first mint, Nyx ruled the space between waking and
            dreaming. Tired of the noise, he folded himself into sleep,
            skateboard tucked under one arm, camera at his side, and left the
            dream world quiet and unclaimed.
          </p>
          <p>
            He left one rule behind: he wakes only when a circle of dreamers
            proves itself real. Not by luck, and not by one person alone, but by
            many small, ordinary acts of showing up.
          </p>
          <p>
            That&apos;s the loop this page runs on. Community actions fill the
            meter. The meter moves Nyx from sleep toward waking. And what you
            unlock along the way depends on how far the whole circle gets, not
            just you.
          </p>
        </div>

        <div
          className="loop"
          role="region"
          aria-label="The Nyx flywheel: sleep, stir, wake, dream, and back to sleep"
        >
          <div className="loop-node">
            <div className="dot" aria-hidden="true">
              🌑
            </div>
            <span>Sleep</span>
          </div>
          <div className="loop-arrow" aria-hidden="true">
            →
          </div>
          <div className="loop-node">
            <div className="dot" aria-hidden="true">
              🌗
            </div>
            <span>Stir</span>
          </div>
          <div className="loop-arrow" aria-hidden="true">
            →
          </div>
          <div className="loop-node">
            <div className="dot" aria-hidden="true">
              ✦
            </div>
            <span>Wake</span>
          </div>
          <div className="loop-arrow" aria-hidden="true">
            →
          </div>
          <div className="loop-node">
            <div className="dot" aria-hidden="true">
              🎞️
            </div>
            <span>Dream</span>
          </div>
        </div>
      </div>
    </section>
  );
}
