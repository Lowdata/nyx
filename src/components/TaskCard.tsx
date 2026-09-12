'use client';

import { useState } from 'react';
import { TaskItem } from '@/types';

interface TaskCardProps {
  tasksDone: Record<string, boolean>;
  onCompleteTask: (taskId: string, pts: number) => void;
  referralCode: string | null;
  onGenerateReferral: () => string;
  pct: number;
}

export default function TaskCard({
  tasksDone,
  onCompleteTask,
  referralCode,
  onGenerateReferral,
  pct,
}: TaskCardProps) {
  const [copiedLink, setCopiedLink] = useState<string | null>(
    referralCode ? `https://nyx.gg/?ref=${referralCode}` : null
  );

  const tasks: TaskItem[] = [
    { id: 'connect', icon: '🔗', title: 'Connect wallet', pts: 150 },
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
      pts: 150,
      onComplete: () => {
        const code = onGenerateReferral();
        const link = `https://nyx.gg/?ref=${code}`;
        try {
          navigator.clipboard.writeText(link);
        } catch {
          // Clipboard may be restricted in some iframe contexts
        }
        setCopiedLink(link);
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

  return (
    <div className="task-card">
      <h3>Tasks</h3>
      <p className="task-card-note">Each one adds wake points, once.</p>

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
                {t.id === 'referral' && (copiedLink || referralCode) && (
                  <div className="task-extra">
                    {isDone ? `Copied: ${copiedLink || `https://nyx.gg/?ref=${referralCode}`}` : ''}
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

      <div className="mini-meter">
        <div className="mini-meter-top">
          <span>Dream meter</span>
          <strong>{Math.round(pct)}%</strong>
        </div>
        <div className="zone-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="z z-sleep" title="Sleep tier (0 - 600 pts)" />
          <div className="z z-fcfs" title="FCFS tier (600 - 1100 pts)" />
          <div className="z z-gtd" title="Guaranteed tier (1100 - 2200 pts)" />
          <div className="zone-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
