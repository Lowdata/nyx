'use client';

import { useState } from 'react';

const IMAGES = Array.from({ length: 30 }, (_, i) => `/${i + 1}.png`);

export default function SwapDesk() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const handleReroll = () => {
    if (isFading) return;
    setIsFading(true);

    let nextIdx = currentIdx;
    while (nextIdx === currentIdx) {
      nextIdx = Math.floor(Math.random() * IMAGES.length);
    }

    setTimeout(() => {
      setCurrentIdx(nextIdx);
      setIsFading(false);
    }, 220);
  };

  return (
    <section className="land-swap" id="swap" aria-labelledby="swap-heading">
      <div className="wrap" style={{ textAlign: 'center' }}>
        <div className="land-swap-header">
          <p className="land-kicker mono">// preview</p>
          <h2 id="swap-heading" className="land-section-title">
            A look at the characters.
          </h2>
          <p className="land-section-sub" style={{ maxWidth: 560, margin: '0 auto 36px' }}>
            Click to explore different sketched looks across the Nyx collection.
            Hand-sketched before anything else.
          </p>
        </div>

        <div className="land-desk" style={{ maxWidth: 480, margin: '0 auto' }}>
          {/* Character Art Preview */}
          <div
            className="land-desk-art"
            onClick={handleReroll}
            style={{ cursor: isFading ? 'default' : 'pointer' }}
            title="Click to change image"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReroll(); } }}
            aria-label="Click to view next character look"
          >
            <img
              src={IMAGES[currentIdx]}
              alt="Nyx character look"
              className={isFading ? 'fading' : ''}
            />
          </div>

          {/* Action Button */}
          <div className="land-desk-actions" style={{ justifyContent: 'center', marginTop: '20px' }}>
            <button
              type="button"
              className="land-btn-primary"
              id="rerollBtn"
              onClick={handleReroll}
              disabled={isFading}
              style={{
                fontSize: '1rem',
                padding: '14px 32px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isFading ? 'default' : 'pointer',
              }}
              title="Click to view another image"
            >
              <span>Change image</span>
              <span aria-hidden="true">✦</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
