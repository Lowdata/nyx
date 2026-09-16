'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import TaskCard from './TaskCard';
import { SLEEP_END, FCFS_END } from '@/hooks/useDreamState';

interface HeroProps {
  points: number;
  pct: number;
  tasksDone?: Record<string, boolean>;
  onCompleteTask: (taskId: string, pts: number) => void;
  referralCode: string | null;
  referralsCount?: number;
  onConnectWallet?: () => void;
  onConnectTwitter?: () => void;
  onOpenSpin?: () => void;
  onOpenTweet?: () => void;
}

export default function Hero({
  points,
  pct,
  tasksDone = {},
  onCompleteTask,
  referralCode,
  referralsCount,
  onConnectWallet,
  onConnectTwitter,
  onOpenSpin,
  onOpenTweet,
}: HeroProps) {
  const [scrollY, setScrollY] = useState(0);
  const visualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const parallaxShift = Math.min(45, scrollY * 0.08);

  let eyebrow = 'DEEP ASLEEP';
  let title = 'Nyx is dreaming.';
  let sub = 'He wakes when the circle proves itself: one wallet, one post, one dream at a time.';

  if (points >= FCFS_END) {
    eyebrow = 'DAWN BREAKING';
    title = 'Nyx is waking.';
    sub = 'FCFS spots are open. Guaranteed spots need the whole circle, not just you.';
  } else if (points >= SLEEP_END) {
    eyebrow = 'STIRRING';
    title = 'Nyx is stirring.';
    sub = 'Getting closer. A few more collective actions and FCFS spots unlock.';
  }

  return (
    <section className="hero" id="top" aria-label="Hero">
      {/* Background Visual: Nyx artwork positioned on the right */}
      <div className="hero-visual" ref={visualRef}>
        <div
          className="hero-visual-inner"
          style={{ transform: `translateY(${parallaxShift}px)` }}
        >
          <Image
            src="/main.webp"
            alt="Nyx, a small sleeping figure with braided hair, resting on clouds beneath a giant moon, surrounded by floating dream doorways and photographs"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover' }}
          />
        </div>
        <div className="hero-scrim" />
      </div>

      {/* Hero Panel on the Left of the image */}
      <div className="hero-panel" id="tasks">
        <p className="hero-eyebrow">{eyebrow}</p>
        <h1 className="hero-title">{title}</h1>
        <p className="hero-sub">{sub}</p>

        {/* Task List on the left of the image in the first glance */}
        <TaskCard
          points={points}
          tasksDone={tasksDone}
          onCompleteTask={onCompleteTask}
          referralCode={referralCode}
          referralsCount={referralsCount}
          onConnectWallet={onConnectWallet}
          onConnectTwitter={onConnectTwitter}
          onOpenSpin={onOpenSpin}
          onOpenTweet={onOpenTweet}
          pct={pct}
        />
      </div>
    </section>
  );
}
