'use client';

import { useState } from 'react';

export interface Look {
  img: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';
}

const LOOKS: Look[] = [
  { img: '/1.png', name: 'static signal', rarity: 'uncommon' },
  { img: '/2.png', name: 'blue hour', rarity: 'rare' },
  { img: '/3.png', name: 'happy tears', rarity: 'uncommon' },
  { img: '/4.png', name: 'gold hour', rarity: 'legendary' },
  { img: '/5.png', name: 'shadow walker', rarity: 'rare' },
  { img: '/6.png', name: 'moon drifter', rarity: 'common' },
  { img: '/7.png', name: 'cloud weaver', rarity: 'uncommon' },
  { img: '/8.png', name: 'star gazer', rarity: 'rare' },
  { img: '/9.png', name: 'solar veil', rarity: 'legendary' },
  { img: '/10.png', name: 'midnight muse', rarity: 'mythic' },
];

const RARITY_COLORS: Record<Look['rarity'], string> = {
  common: '#5b4f30',
  uncommon: '#2d6a4f',
  rare: '#2a6f97',
  legendary: '#b7791f',
  mythic: '#7b2cbf',
};

export default function SwapDesk() {
  const [credits, setCredits] = useState(3);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const currentLook = LOOKS[currentIdx];

  const handleReroll = () => {
    if (credits <= 0 || isFading) return;
    setCredits((prev) => prev - 1);
    setIsFading(true);

    let nextIdx = currentIdx;
    while (nextIdx === currentIdx) {
      nextIdx = Math.floor(Math.random() * LOOKS.length);
    }

    setTimeout(() => {
      setCurrentIdx(nextIdx);
      setIsFading(false);
      setFeedback('Rerolled · 1 credit spent');
      setTimeout(() => setFeedback(null), 1800);
    }, 220);
  };

  const handleRecycle = () => {
    setCredits((prev) => prev + 1);
    setFeedback('+1 credit banked');
    setTimeout(() => setFeedback(null), 1800);
  };

  return (
    <section className="land-swap" id="swap" aria-labelledby="swap-heading">
      <div className="wrap">
        <div className="land-swap-header">
          <p className="land-kicker mono">// preview</p>
          <h2 id="swap-heading" className="land-section-title">
            A look at the swap desk.
          </h2>
          <p className="land-section-sub" style={{ maxWidth: 560, margin: '0 0 40px' }}>
            Recycle a look you&apos;re done with, bank the credit, spend it on the next one.
            Early preview, the full system unlocks at mint.
          </p>
        </div>

        <div className="land-desk">
          <div className="land-desk-inner">
            {/* Left: Character Art Preview */}
            <div className="land-desk-art">
              <img
                src={currentLook.img}
                alt={`Nyx character look: ${currentLook.name}`}
                className={isFading ? 'fading' : ''}
              />
              <div className="land-desk-rarity-pill" style={{ color: RARITY_COLORS[currentLook.rarity] }}>
                {currentLook.rarity}
              </div>
            </div>

            {/* Right: Controls & Traits */}
            <div className="land-desk-panel">
              <div className="land-credit-row">
                <span className="land-credit-label mono">swap credits</span>
                <span className="land-credit-value" id="creditVal">
                  {credits}
                </span>
              </div>

              <div className="land-trait-row">
                <span className="land-trait-name">Current look</span>
                <span className="land-trait-val" id="lookName">
                  {currentLook.name}
                </span>
              </div>

              <div className="land-trait-row">
                <span className="land-trait-name">Rarity read</span>
                <span
                  className="land-trait-val"
                  id="rarityVal"
                  style={{ color: RARITY_COLORS[currentLook.rarity], fontWeight: 700 }}
                >
                  {currentLook.rarity}
                </span>
              </div>

              <div className="land-trait-row">
                <span className="land-trait-name">Recycle value</span>
                <span className="land-trait-val" style={{ color: '#2d6a4f' }}>
                  +1 credit
                </span>
              </div>

              {/* Action Buttons */}
              <div className="land-desk-actions">
                <button
                  type="button"
                  className="land-btn-primary"
                  id="rerollBtn"
                  onClick={handleReroll}
                  disabled={credits <= 0 || isFading}
                  style={{
                    opacity: credits <= 0 ? 0.5 : 1,
                    cursor: credits <= 0 ? 'not-allowed' : 'pointer',
                  }}
                  title={credits <= 0 ? 'No credits remaining — recycle a look to earn more' : 'Reroll to another character look'}
                >
                  {credits <= 0 ? 'Out of credits' : 'Reroll look · 1 credit'}
                </button>

                <button
                  type="button"
                  className="land-btn-ghost"
                  id="recycleBtn"
                  onClick={handleRecycle}
                  title="Bank 1 swap credit"
                >
                  Recycle current look
                </button>
              </div>

              {feedback && (
                <div className="land-desk-feedback" role="status">
                  {feedback}
                </div>
              )}

              <p className="land-desk-note">
                Preview only. Doesn&apos;t touch your actual wallet or holdings, this is just to show how it&apos;ll feel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
