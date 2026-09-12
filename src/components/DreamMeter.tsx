'use client';

import Image from 'next/image';
import { TARGET, SLEEP_END, FCFS_END } from '@/hooks/useDreamState';
import { DreamStage } from '@/types';

interface DreamMeterProps {
  points: number;
  pct: number;
  stage: DreamStage;
}

export default function DreamMeter({ points, pct, stage }: DreamMeterProps) {
  const isSleepActive = points < SLEEP_END;
  const isFcfsActive = points >= SLEEP_END && points < FCFS_END;
  const isGtdActive = points >= FCFS_END;

  return (
    <section className="meter-section" id="meter" aria-labelledby="meter-heading">
      <div className="wrap">
        <div className="section-head">
          <p className="kicker">Live progress</p>
          <h2 id="meter-heading">The dream meter</h2>
          <p>
            Three tiers, one bar. Sleep is where everyone starts. FCFS opens to
            anyone who shows up. Guaranteed only fills when the whole circle moves
            together — which is why it&apos;s built to stay just out of reach for
            any one dreamer.
          </p>
        </div>

        <div className="meter-card">
          <div className="meter-top">
            <div>
              <div className="meter-pct">{Math.round(pct)}%</div>
              <div className="meter-stage">{stage}</div>
            </div>
            <div className="meter-points">
              {Math.min(points, TARGET)} / {TARGET} points collected
            </div>
          </div>

          <div
            className="big-track"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Dream meter overall progress"
          >
            <div className="big-track-inner">
              <div className="z z-sleep" title="Sleep tier (0 - 600 pts)" />
              <div className="z z-fcfs" title="FCFS tier (600 - 1100 pts)" />
              <div className="z z-gtd" title="Guaranteed tier (1100 - 2200 pts)" />
            </div>
            <div className="big-fill" style={{ width: `${pct}%` }} />
            <div
              className="big-thumb"
              style={{ left: `${pct}%` }}
              title="Nyx consciousness indicator"
            >
              <Image
                src="/main.webp"
                alt="Nyx avatar indicator"
                width={44}
                height={44}
                style={{ objectFit: 'cover' }}
              />
            </div>
          </div>

          <div className="tier-labels">
            <div className={`tier-label ${isSleepActive ? 'active' : ''}`} id="tier-sleep">
              <h4>🌑 Sleep</h4>
              <span>0 – 600 pts</span>
            </div>
            <div className={`tier-label ${isFcfsActive ? 'active' : ''}`} id="tier-fcfs">
              <h4>🌗 FCFS</h4>
              <span>600 – 1,100 pts</span>
            </div>
            <div className={`tier-label gtd ${isGtdActive ? 'active gtd' : ''}`} id="tier-gtd">
              <h4>☀️ Guaranteed</h4>
              <span>1,100 – 2,200 pts</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
