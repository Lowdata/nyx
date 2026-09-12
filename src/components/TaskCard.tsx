'use client';

import { useState } from 'react';
import { TaskItem } from '@/types';

interface TaskCardProps {
  tasksDone: Record<string, boolean>;
  onCompleteTask: (taskId: string, pts: number) => void;
  referralCode: string | null;
  onConnectWallet?: () => void;
  pct: number;
}

export default function TaskCard({
  tasksDone,
  onCompleteTask,
  referralCode,
  onConnectWallet,
  pct,
}: TaskCardProps) {
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
    { id: 'follow', icon: '✕', title: 'Follow @NyxSummons', pts: 100 },
    { id: 'like', icon: '♥', title: 'Like the summons post', pts: 100 },
    { id: 'repost', icon: '↻', title: 'Repost the summons', pts: 100 },
    { id: 'comment', icon: '💬', title: 'Comment your dream', pts: 100 },
    { id: 'discord', icon: '◈', title: 'Join the dream circle Discord', pts: 150 },
    {
      id: 'referral',
      icon: '🎁',
      title: 'Join & share the Referral Circle',
      pts: 150,
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
    if (tasksDone[task.id]) return;
    if (task.onComplete) {
      task.onComplete();
    }
    onCompleteTask(task.id, task.pts);
  };

  const doneCount = tasks.filter((t) => !!tasksDone[t.id]).length;

  return (
    <div className="task-card">
      <div className="task-card-header">
        <div>
          <h3>Awaken Tasks</h3>
          <p className="task-card-note">Each action adds wake points to the collective meter.</p>
        </div>
        <div className="task-count-pill">
          {doneCount} / {tasks.length} Done
        </div>
      </div>

      <div className="task-list-wrap">
        {tasks.map((t) => {
          const isDone = !!tasksDone[t.id];
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
                        Summon link copied!{' '}
                        <a href="#referrals" className="task-ref-link">
                          Open Referral Hub →
                        </a>
                      </span>
                    ) : (
                      <span>Unlocks invite rewards &amp; circle rank</span>
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

      <a href="#meter" className="mini-meter" title="Click to view the full Dream Meter">
        <div className="mini-meter-top">
          <span>Live Dream Meter</span>
          <strong>{Math.round(pct)}% • View Bar ↑</strong>
        </div>
        <div className="zone-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="z z-sleep" title="Sleep tier (0 - 600 pts)" />
          <div className="z z-fcfs" title="FCFS tier (600 - 1100 pts)" />
          <div className="z z-gtd" title="Guaranteed tier (1100 - 2200 pts)" />
          <div className="zone-fill" style={{ width: `${pct}%` }} />
        </div>
      </a>
    </div>
  );
}

