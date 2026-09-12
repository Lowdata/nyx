'use client';

import { useState, useEffect, useRef } from 'react';

interface SpinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpinWin: (pts: number) => void;
  remainingMs: number;
}

const SEGMENTS = [50, 100, 150, 200, 250, 300];
const COLORS = ['#232a54', '#3d3f7a', '#232a54', '#3d3f7a', '#232a54', '#3d3f7a'];

function formatRemaining(ms: number): string {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

export default function SpinModal({
  isOpen,
  onClose,
  onSpinWin,
  remainingMs,
}: SpinModalProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [resultText, setResultText] = useState('');
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSpinning) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSpinning, onClose]);

  const per = 360 / SEGMENTS.length;
  const gradientParts = SEGMENTS.map((_, i) => {
    const start = (i * per).toFixed(2);
    const end = ((i + 1) * per).toFixed(2);
    return `${COLORS[i]} ${start}deg ${end}deg`;
  });
  const backgroundConic = `conic-gradient(from 0deg, ${gradientParts.join(', ')})`;

  const handleSpin = () => {
    if (remainingMs > 0 || isSpinning) return;
    setIsSpinning(true);
    setResultText('');

    const targetIndex = Math.floor(Math.random() * SEGMENTS.length);
    const segCenter = targetIndex * per + per / 2;
    // Rotate at least 5 full turns (1800deg) + the target sector adjustment
    const extraRot = 360 * 5 + ((360 - segCenter) % 360);
    const nextRot = rotation + extraRot;
    setRotation(nextRot);

    setTimeout(() => {
      const won = SEGMENTS[targetIndex];
      setResultText(`+${won} pts — landed on ${won}!`);
      setIsSpinning(false);
      onSpinWin(won);
    }, 3900);
  };

  if (!isOpen) return null;

  const isCooldown = remainingMs > 0;

  return (
    <div
      className={`modal-backdrop ${isOpen ? 'open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSpinning) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spin-modal-title"
    >
      <div className="modal-panel">
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close modal"
          disabled={isSpinning}
        >
          ✕
        </button>

        <h3 id="spin-modal-title">Spin the moon wheel</h3>
        <p className="desc">One spin, then it resets in 24 hours.</p>

        <div className="wheel-zone">
          <div className="wheel-outer">
            <div className="wheel-pointer" aria-hidden="true" />
            <div
              className="wheel"
              ref={wheelRef}
              style={{
                background: backgroundConic,
                transform: `rotate(${rotation}deg)`,
              }}
            >
              {SEGMENTS.map((pts, i) => {
                const angle = i * per + per / 2;
                const rad = ((angle - 90) * Math.PI) / 180;
                const r = 68;
                const x = Math.cos(rad) * r;
                const y = Math.sin(rad) * r;
                return (
                  <div
                    key={pts}
                    className="wheel-label"
                    style={{
                      transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                    }}
                  >
                    {pts}
                  </div>
                );
              })}
            </div>
            <div className="wheel-hub" aria-hidden="true" />
          </div>

          <button
            type="button"
            className="btn btn-gold"
            onClick={handleSpin}
            disabled={isCooldown || isSpinning}
          >
            {isSpinning ? 'Spinning...' : isCooldown ? `Next spin in ${formatRemaining(remainingMs)}` : 'Spin'}
          </button>

          <div className="wheel-result" aria-live="polite">
            {resultText}
          </div>

          <p className="cooldown-note">
            {isCooldown
              ? `Next spin available in ${formatRemaining(remainingMs)}.`
              : 'You get one spin every 24 hours.'}
          </p>
        </div>
      </div>
    </div>
  );
}
