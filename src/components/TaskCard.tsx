'use client';

import { useState } from 'react';
import { TaskItem } from '@/types';

interface TaskCardProps {
  tasksDone?: Record<string, boolean>;
  onCompleteTask: (taskId: string, pts: number) => void;
  referralCode: string | null;
  onConnectWallet?: () => void;
  onOpenSpin?: () => void;
  onOpenTweet?: () => void;
  pct: number;
  points?: number;
}

export default function TaskCard({
  tasksDone = {},
  onCompleteTask,
  referralCode,
  onConnectWallet,
  onOpenSpin,
  onOpenTweet,
  pct,
  points,
}: TaskCardProps) {
  const safeTasksDone = tasksDone || {};
  const [copiedLink, setCopiedLink] = useState<string | null>(
    referralCode ? `https://nyx.gg/?ref=${referralCode}` : null
  );

  const tasks: TaskItem[] = [
    {
      id: 'connect',
      icon: '🔗',
      title: 'Connect & sign wallet',
      pts: 150,
      onComplete: () => {
        if (onConnectWallet) onConnectWallet();
      },
    },
    { id: 'connectx', icon: '@', title: 'Connect X account', pts: 100 },
    { id: 'follow', icon: '✕', title: 'Follow the page', pts: 100 },
    { id: 'like', icon: '♥', title: 'Like the summons', pts: 100 },
    { id: 'repost', icon: '↻', title: 'Repost the summons', pts: 100 },
    { id: 'comment', icon: '💬', title: 'Comment your dream', pts: 100 },
    { id: 'discord', icon: '◈', title: 'Join the dream circle', pts: 150 },
    {
      id: 'referral',
      icon: '🎁',
      title: 'Grab your referral link',
      pts: 100,
      onComplete: () => {
        if (referralCode) {
          const link = typeof window !== 'undefined'
            ? `${window.location.origin}/?ref=${referralCode}`
            : `https://nyx.gg/?ref=${referralCode}`;
          try {
            navigator.clipboard.writeText(link);
          } catch {
            // Clipboard fallback
          }
          setCopiedLink(link);
        } else if (typeof window !== 'undefined') {
          window.location.href = '#referrals';
        }
      },
    },
  ];

  const handleTaskClick = (task: TaskItem) => {
    if (safeTasksDone[task.id]) return;
    if (task.onComplete) {
      task.onComplete();
    }
    onCompleteTask(task.id, task.pts);
  };

  const doneCount = tasks.filter((t) => !!safeTasksDone[t.id]).length;

  return (
    <div className="task-card">
      {/* 1. METER ON TOP OF THE TASK BOX */}
      <a href="#meter" className="task-card-meter" title="Click to view the full Dream Meter section">
        <div className="mini-meter-top">
          <div className="meter-badge-title-group">
            <span className="meter-badge-title">Dream meter</span>
            {typeof points === 'number' && (
              <span className="meter-badge-pts">{points} / 2,200 pts</span>
            )}
          </div>
          <strong className="meter-badge-pct">{Math.round(pct)}% Awoken</strong>
        </div>
        <div
          className="zone-track"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="z z-sleep" title="Sleep tier (0 - 600 pts)" />
          <div className="z z-fcfs" title="FCFS tier (600 - 1100 pts)" />
          <div className="z z-gtd" title="Guaranteed tier (1100 - 2200 pts)" />
          <div className="zone-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="mini-meter-tiers">
          <span className={points === undefined || points < 600 ? 'tier-dot active' : 'tier-dot'}>
            🌑 Sleep
          </span>
          <span className={points !== undefined && points >= 600 && points < 1100 ? 'tier-dot active' : 'tier-dot'}>
            🌓 FCFS (600)
          </span>
          <span className={points !== undefined && points >= 1100 ? 'tier-dot active' : 'tier-dot'}>
            🌕 Guaranteed (1,100)
          </span>
        </div>
      </a>

      {/* 2. TASKS HEADER */}
      <div className="task-card-header">
        <div>
          <h3>Tasks</h3>
          <p className="task-card-note">Each one adds wake points, once.</p>
        </div>
        <div className="task-count-pill">
          {doneCount} / {tasks.length} Done
        </div>
      </div>

      {/* 3. TASK LIST */}
      <div className="task-list-wrap">
        {tasks.map((t) => {
          const isDone = !!safeTasksDone[t.id];
          return (
            <div key={t.id} className="task-row">
              <div className="task-icon" aria-hidden="true">
                {t.icon}
              </div>
              <div className="task-info">
                <div className="task-title">{t.title}</div>
                <div className="task-pts">+{t.pts} pts</div>
                {t.id === 'referral' && (
                  <div className="task-extra">
                    {isDone ? (
                      <span>
                        Link copied!{' '}
                        <a href="#referrals" className="task-ref-link">
                          Circle Hub →
                        </a>
                      </span>
                    ) : (
                      <span>Unlocks invite rewards &amp; circle tiers</span>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`check-btn ${isDone ? 'done' : ''}`}
                aria-pressed={isDone}
                aria-label={`Mark ${t.title} as done`}
                onClick={() => handleTaskClick(t)}
                disabled={isDone}
              >
                ✓
              </button>
            </div>
          );
        })}
      </div>

      {/* 4. FIRST GLANCE ACTION BUTTONS */}
      <div className="hero-ritual-buttons">
        <button
          type="button"
          className="btn btn-ghost hero-action-btn"
          onClick={onOpenTweet}
        >
          <span>✕</span>
          <span>Submit tweet</span>
        </button>
        <button
          type="button"
          className="btn btn-gold hero-action-btn"
          onClick={onOpenSpin}
        >
          <span>⚡</span>
          <span>Spin the wheel</span>
        </button>
      </div>
    </div>
  );
}
