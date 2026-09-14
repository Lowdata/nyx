'use client';

import { useState, useEffect, useRef } from 'react';
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

const DEFAULT_TASK_ITEMS: TaskItem[] = [
  {
    id: 'connect',
    icon: '🔗',
    title: 'Connect & sign wallet',
    pts: 150,
    type: 'wallet',
  },
  {
    id: 'follow',
    icon: '✕',
    title: 'Follow @enternyx on X',
    pts: 100,
    type: 'twitter_intent',
    intentUrl: 'https://twitter.com/intent/follow?screen_name=enternyx',
  },
  {
    id: 'like',
    icon: '♥',
    title: 'Like the summons',
    pts: 100,
    type: 'twitter_intent',
    intentUrl: 'https://x.com/enternyx',
  },
  {
    id: 'repost',
    icon: '↻',
    title: 'Repost the summons',
    pts: 100,
    type: 'twitter_intent',
    intentUrl: 'https://twitter.com/intent/tweet?text=Nyx%20is%20dreaming...%20Wake%20the%20God%20of%20Sleep%20%F0%9F%8C%99%20%40enternyx%20https%3A%2F%2Fnyx.gg',
  },
  {
    id: 'comment',
    icon: '💬',
    title: 'Comment your dream',
    pts: 100,
    type: 'twitter_intent',
    intentUrl: 'https://twitter.com/intent/tweet?text=%40enternyx%20My%20dream%20is%20',
  },
  {
    id: 'discord',
    icon: '◈',
    title: 'Join the dream circle',
    pts: 150,
    type: 'social',
    externalLink: 'https://discord.gg/enternyx',
  },
  {
    id: 'referral',
    icon: '🎁',
    title: 'Grab your referral link',
    pts: 100,
    type: 'referral',
  },
];

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
  const [tasks, setTasks] = useState<TaskItem[]>(DEFAULT_TASK_ITEMS);
  const [activeTimers, setActiveTimers] = useState<Record<string, number>>({});
  const [, setCopiedLink] = useState<string | null>(
    referralCode ? `https://nyx.gg/?ref=${referralCode}` : null
  );

  const tasksRef = useRef<TaskItem[]>(tasks);
  const onCompleteRef = useRef(onCompleteTask);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    onCompleteRef.current = onCompleteTask;
  }, [onCompleteTask]);

  // 1. Fetch live tasks from MongoDB collection
  useEffect(() => {
    fetch('/api/tasks')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.tasks) && data.tasks.length > 0) {
          setTasks(data.tasks);
        }
      })
      .catch(() => {
        // Fallback to initial tasks
      });
  }, []);

  // 2. 10-Second Auto-Complete Countdown Timer
  useEffect(() => {
    const hasRunningTimers = Object.values(activeTimers).some((s) => s > 0);
    if (!hasRunningTimers) return;

    const interval = setInterval(() => {
      const completedList: { taskId: string; pts: number }[] = [];

      setActiveTimers((prev) => {
        const next = { ...prev };
        let updated = false;

        for (const [taskId, remaining] of Object.entries(next)) {
          if (remaining > 1) {
            next[taskId] = remaining - 1;
            updated = true;
          } else if (remaining === 1) {
            delete next[taskId];
            updated = true;

            const matchedTask = tasksRef.current.find((t) => t.id === taskId);
            const pts = matchedTask ? matchedTask.pts : 100;
            completedList.push({ taskId, pts });
          }
        }

        return updated ? next : prev;
      });

      // Schedule callback outside the React state updater to avoid setState in render error
      if (completedList.length > 0) {
        setTimeout(() => {
          for (const item of completedList) {
            onCompleteRef.current(item.taskId, item.pts);
          }
        }, 0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimers]);

  // 3. User clicks any task: immediate action redirect/copy + start 10s timer
  const handleTaskClick = (task: TaskItem) => {
    if (safeTasksDone[task.id]) return;
    if (activeTimers[task.id] && activeTimers[task.id] > 0) return;

    // Direct Action Execution
    if (task.id === 'connect') {
      if (onConnectWallet) onConnectWallet();
      setActiveTimers((prev) => ({ ...prev, [task.id]: 10 }));
      return;
    }

    if (task.id === 'referral') {
      const link = referralCode
        ? typeof window !== 'undefined'
          ? `${window.location.origin}/?ref=${referralCode}`
          : `https://nyx.gg/?ref=${referralCode}`
        : typeof window !== 'undefined'
        ? `${window.location.origin}/#referrals`
        : 'https://nyx.gg/#referrals';

      try {
        navigator.clipboard.writeText(link);
      } catch {
        // Clipboard fallback
      }
      setCopiedLink(link);
      setActiveTimers((prev) => ({ ...prev, [task.id]: 10 }));
      return;
    }

    // Twitter Web Intent or External Link redirect
    const targetLink = task.intentUrl || task.externalLink;
    if (targetLink && typeof window !== 'undefined') {
      window.open(targetLink, '_blank', 'noopener,noreferrer');
    }

    // Start 10-second auto-completion timer
    setActiveTimers((prev) => ({ ...prev, [task.id]: 10 }));
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
          <p className="task-card-note">Click any quest to launch. Auto-completes in 10s.</p>
        </div>
        <div className="task-count-pill">
          {doneCount} / {tasks.length} Done
        </div>
      </div>

      {/* 3. TASK LIST */}
      <div className="task-list-wrap">
        {tasks.map((t) => {
          const isDone = !!safeTasksDone[t.id];
          const remainingSec = activeTimers[t.id];
          const isVerifying = typeof remainingSec === 'number' && remainingSec > 0;

          return (
            <div
              key={t.id}
              className="task-row"
              onClick={() => {
                if (!isDone && !isVerifying) {
                  handleTaskClick(t);
                }
              }}
              style={{ cursor: isDone ? 'default' : 'pointer' }}
            >
              <div className="task-icon" aria-hidden="true">
                {t.icon}
              </div>
              <div className="task-info">
                <div className="task-title">{t.title}</div>
                <div className="task-pts">+{t.pts} pts</div>

                {/* Status Badges & Explanations */}
                {isVerifying && (
                  <div className="task-status-pill">
                    <span className="task-spinner-dot" />
                    <span>Auto-completing in {remainingSec}s...</span>
                  </div>
                )}

                {t.id === 'referral' && !isVerifying && (
                  <div className="task-extra">
                    {isDone ? (
                      <span>
                        Link copied!{' '}
                        <a href="#referrals" className="task-ref-link" onClick={(e) => e.stopPropagation()}>
                          Circle Hub →
                        </a>
                      </span>
                    ) : (
                      <span>Copies link &amp; unlocks invite rewards</span>
                    )}
                  </div>
                )}

                {t.intentUrl && !isVerifying && !isDone && (
                  <div className="task-extra" style={{ opacity: 0.85 }}>
                    Opens X intent • completes in 10s
                  </div>
                )}
              </div>

              {/* Action / Check Button */}
              {isDone ? (
                <button
                  type="button"
                  className="check-btn done"
                  aria-pressed="true"
                  aria-label={`${t.title} completed`}
                  disabled
                >
                  ✓
                </button>
              ) : isVerifying ? (
                <button
                  type="button"
                  className="check-btn verifying"
                  aria-label={`${t.title} verifying`}
                  title="Verifying completion..."
                  disabled
                >
                  <span className="check-btn-spinner" />
                </button>
              ) : (
                <button
                  type="button"
                  className="check-btn"
                  aria-label={`Start ${t.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTaskClick(t);
                  }}
                  title={t.intentUrl ? 'Open on X' : 'Complete task'}
                >
                  {t.intentUrl || t.externalLink ? '↗' : '✓'}
                </button>
              )}
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
