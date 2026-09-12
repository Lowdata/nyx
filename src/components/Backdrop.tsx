'use client';

import { useEffect, useState } from 'react';

interface Star {
  id: number;
  size: number;
  left: number;
  top: number;
  delay: number;
  duration: number;
}

export default function Backdrop({ glowPct }: { glowPct: number }) {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    // Generate stars on client mount to ensure consistent hydration
    const count = window.innerWidth < 600 ? 40 : 75;
    const generated: Star[] = [];
    for (let i = 0; i < count; i++) {
      generated.push({
        id: i,
        size: Math.random() * 2 + 1,
        left: Math.random() * 100,
        top: Math.random() * 60,
        delay: Math.random() * 4,
        duration: 3 + Math.random() * 3,
      });
    }
    setStars(generated);
  }, []);

  useEffect(() => {
    // Update CSS custom property for atmospheric ambient glow
    const normalizedGlow = Math.min(1, Math.max(0, glowPct / 100)).toFixed(3);
    document.documentElement.style.setProperty('--glow', normalizedGlow);
  }, [glowPct]);

  return (
    <>
      <div className="sky" aria-hidden="true" />
      <div className="stars" aria-hidden="true">
        {stars.map((s) => (
          <div
            key={s.id}
            className="star"
            style={{
              width: `${s.size}px`,
              height: `${s.size}px`,
              left: `${s.left}%`,
              top: `${s.top}%`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}
