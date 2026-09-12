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

  // Calculate points to next tier
  let nextMilestoneText = '';
  if (points < SLEEP_END) {
    nextMilestoneText = `${SLEEP_END - points} pts to unlock FCFS Tier`;
  } else if (points < FCFS_END) {
    nextMilestoneText = `${FCFS_END - points} pts to unlock Guaranteed Tier`;
  } else if (points < TARGET) {
    nextMilestoneText = `${TARGET - points} pts until Nyx is fully awake!`;
  } else {
    nextMilestoneText = 'All tiers unlocked! Nyx is fully awake.';
  }

  return (
    <section className="meter-section" id="meter" aria-labelledby="meter-heading">
      <div className="wrap">
        <div className="section-head">
          <div className="meter-kicker-row">
            <span className="kicker">Live Community Progress</span>
            <span className="live-badge">
              <span className="live-dot" /> LIVE SYNC
            </span>
          </div>
          <h2 id="meter-heading">The Dream Meter</h2>
          <p>
            Three tiers, one shared bar. Every quest completed, daily spin, and friend
            invited fills the meter. Sleep is where everyone starts — FCFS opens at 600 pts,
            and Guaranteed spots unlock when the circle reaches 1,100 pts together.
          </p>
        </div>

        <div className="meter-card">
          <div className="meter-top">
            <div>
              <div className="meter-pct">{Math.round(pct)}%</div>
              <div className="meter-stage-badge">
                <span className="stage-indicator" />
                <span className="meter-stage">{stage}</span>
              </div>
            </div>
            <div className="meter-points-box">
              <div className="meter-points">
                <strong>{Math.min(points, TARGET)}</strong> / {TARGET} points collected
              </div>
              <div className="meter-milestone-pill">{nextMilestoneText}</div>
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
                width={48}
                height={48}
                style={{ objectFit: 'cover' }}
              />
            </div>
          </div>

          <div className="tier-labels">
            <div className={`tier-label ${isSleepActive ? 'active' : ''}`} id="tier-sleep">
              <div className="tier-head">
                <h4>🌑 Sleep</h4>
                {isSleepActive && <span className="tier-status-pill">Active</span>}
              </div>
              <span>0 – 600 pts</span>
              <p className="tier-desc">Where everyone starts. Small acts of showing up stir Nyx from slumber.</p>
            </div>
            <div className={`tier-label ${isFcfsActive ? 'active' : ''}`} id="tier-fcfs">
              <div className="tier-head">
                <h4>🌗 FCFS</h4>
                {isFcfsActive && <span className="tier-status-pill">Active</span>}
                {points >= FCFS_END && <span className="tier-status-pill unlocked">Cleared ✓</span>}
              </div>
              <span>600 – 1,100 pts</span>
              <p className="tier-desc">First Come First Served mint spots open to anyone who participates.</p>
            </div>
            <div className={`tier-label gtd ${isGtdActive ? 'active gtd' : ''}`} id="tier-gtd">
              <div className="tier-head">
                <h4>☀️ Guaranteed</h4>
                {isGtdActive && <span className="tier-status-pill gold">Unlocked!</span>}
              </div>
              <span>1,100 – 2,200 pts</span>
              <p className="tier-desc">Guaranteed mint spot. Only unlocks when the circle moves as one.</p>
            </div>
          </div>

          <div className="meter-quick-ctas">
            <a href="#tasks" className="btn btn-gold">
              ⚡ Complete Tasks
            </a>
            <a href="#referrals" className="btn btn-ghost">
              👥 Invite Friends (+100 pts)
            </a>
            <a href="#rituals" className="btn btn-ghost">
              🌙 Daily Spin
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

