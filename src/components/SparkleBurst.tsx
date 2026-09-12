'use client';

import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  left: number;
  top: number;
  dx: number;
  dy: number;
  color: string;
  size: number;
}

export default function SparkleBurst({ triggerKey }: { triggerKey: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!triggerKey) return;
    const colors = ['#f0d9a0', '#9b8de0', '#eeecf7', '#d8b467'];
    const count = 28;
    const items: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 90;
      items.push({
        id: i,
        left: 50 + (Math.random() - 0.5) * 20,
        top: 40 + (Math.random() - 0.5) * 20,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 4,
      });
    }

    setParticles(items);

    const timer = setTimeout(() => {
      setParticles([]);
    }, 1400);

    return () => clearTimeout(timer);
  }, [triggerKey]);

  if (particles.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 999,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: '50%',
            boxShadow: `0 0 12px 3px ${p.color}`,
            transform: `translate(${p.dx}px, ${p.dy}px)`,
            opacity: 0,
            transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 1.2s ease-out',
            animation: 'none',
          }}
        />
      ))}
    </div>
  );
}
