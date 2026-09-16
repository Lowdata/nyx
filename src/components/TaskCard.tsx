'use client';

import { useState, useEffect, useRef } from 'react';
import { TaskItem } from '@/types';

interface TaskCardProps {
  tasksDone?: Record<string, boolean>;
  onCompleteTask: (taskId: string, pts: number) => void;
  referralCode: string | null;
  referralsCount?: number;
  onConnectWallet?: () => void;
  onConnectTwitter?: () => void;
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
    pts: 50,
    type: 'wallet',
  },
  {
    id: 'connectx',
    icon: '𝕏',
    title: 'Connect X account',
    pts: 50,
    type: 'social',
  },
  {
    id: 'follow',
    icon: '✕',
    title: 'Follow @enternyx on X',
    pts: 30,
    type: 'twitter_intent',
    intentUrl: 'https://twitter.com/intent/follow?screen_name=enternyx',
  },
  {
    id: 'like',
    icon: '♥',
    title: 'Like Tweet',
    pts: 20,
    type: 'twitter_intent',
    intentUrl: 'https://twitter.com/intent/like?tweet_id=2100216839095701608',
  },
  {
    id: 'repost',
    icon: '↻',
    title: 'Retweet the Tweet',
    pts: 30,
    type: 'twitter_intent',
    intentUrl: 'https://twitter.com/intent/retweet?tweet_id=2100216839095701608',
  },
  {
    id: 'comment',
    icon: '💬',
    title: 'Tweet about Nyx',
    pts: 30,
    type: 'twitter_intent',
    intentUrl: 'https://twitter.com/intent/tweet?text=Awakening%20with%20%40enternyx%20%F0%9F%8C%99%20Enter%20the%20dream%20circle%20and%20claim%20your%20wake%20points%3A%20https%3A%2F%2Fnyx.town&in_reply_to=2100216839095701608',
  },
  {
    id: 'referral',
    icon: '🎁',
    title: 'Summon friends on X',
    pts: 10,
    type: 'referral',
  },
];

export default function TaskCard({
  tasksDone = {},
  onCompleteTask,
  referralCode,
  referralsCount,
  onConnectWallet,
  onConnectTwitter,
  onOpenSpin,
  onOpenTweet,
  pct,
  points,
}: TaskCardProps) {
  const safeTasksDone = tasksDone || {};
  const [tasks, setTasks] = useState<TaskItem[]>(DEFAULT_TASK_ITEMS);
  const [activeTimers, setActiveTimers] = useState<Record<string, number>>({});
  const [showInfo, setShowInfo] = useState(false);
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

  // 2. Auto-Complete Countdown Timer (runs in background without displaying numbers)
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
            const pts = matchedTask ? matchedTask.pts : 50;
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

  // 3. User clicks any task: immediate action redirect/copy + start background verification
  const handleTaskClick = (task: TaskItem) => {
    if (task.id !== 'referral' && safeTasksDone[task.id]) return;
    if (activeTimers[task.id] && activeTimers[task.id] > 0) return;

    // Direct Action Execution
    if (task.id === 'connect') {
      if (onConnectWallet) onConnectWallet();
      setActiveTimers((prev) => ({ ...prev, [task.id]: 8 }));
      return;
    }

    if (task.id === 'connectx') {
      if (onConnectTwitter) onConnectTwitter();
      return;
    }

    if (task.id === 'referral') {
      if (!referralCode) {
        if (onConnectWallet) onConnectWallet();
        return;
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nyx.gg';
      const shareUrl = `${origin}/?ref=${referralCode}`;
      const text = encodeURIComponent(
        `I am waking Nyx, the ancient god of sleep. 🌙\n\nEnter the dream circle and claim your wake points with my summon link:\n${shareUrl}\n\n#Nyx #Web3 #WakeNyx`
      );
      try {
        navigator.clipboard.writeText(shareUrl);
      } catch {
        // Clipboard fallback
      }
      setCopiedLink(shareUrl);
      if (typeof window !== 'undefined') {
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    // Twitter Web Intent or External Link redirect
    const targetLink = task.intentUrl || task.externalLink;
    if (targetLink && typeof window !== 'undefined') {
      window.open(targetLink, '_blank', 'noopener,noreferrer');
    }

    // Start auto-completion timer (user only sees existing circular spinner)
    setActiveTimers((prev) => ({ ...prev, [task.id]: 6 }));
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
          <div className="z z-fcfs" title="FCFS tier (600 - 1500 pts)" />
          <div className="z z-gtd" title="Guaranteed tier (1500 - 2200 pts)" />
          <div className="zone-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="mini-meter-tiers">
          <span className={points === undefined || points < 600 ? 'tier-dot active' : 'tier-dot'}>
            🌑 Sleep
          </span>
          <span className={points !== undefined && points >= 600 && points < 1500 ? 'tier-dot active' : 'tier-dot'}>
            🌓 FCFS (600)
          </span>
          <span className={points !== undefined && points >= 1500 ? 'tier-dot active' : 'tier-dot'}>
            🌕 Guaranteed (1,500)
          </span>
        </div>
      </a>

      {/* 2. TASKS HEADER */}
      <div className="task-card-header">
        <div>
          <div className="task-title-row">
            <h3>Tasks</h3>
            <button
              type="button"
              className="task-info-trigger"
              onClick={() => setShowInfo((s) => !s)}
              aria-label="Information about spin and tweet submit"
              title="Click to learn about spin, tweet submit & rituals"
            >
              i
            </button>
          </div>
          <p className="task-card-note">Launch quests to awaken Nyx &amp; climb tiers.</p>
        </div>
        <div className="task-count-pill">
          {doneCount} / {tasks.length} Done
        </div>
      </div>

      {/* RITUALS EXPLAINER POPOVER */}
      {showInfo && (
        <div className="task-info-popover animate-fade-in" role="dialog" aria-label="Rituals and quests guide">
          <div className="task-info-popover-header">
            <h4>Rituals &amp; Quests Guide</h4>
            <button
              type="button"
              className="task-info-close"
              onClick={() => setShowInfo(false)}
              aria-label="Close guide"
            >
              ✕
            </button>
          </div>
          <div className="task-info-card">
            <span className="task-info-badge spin">⚡ Spin the Wheel</span>
            <p>
              Daily Moon Spin resets every <strong>24 hours</strong>. Land anywhere on the wheel to earn <strong>10 to 50 wake points</strong> added directly to your dream meter.
            </p>
          </div>
          <div className="task-info-card">
            <span className="task-info-badge tweet">✕ Submit Tweet</span>
            <p>
              Share an awakening post about Nyx on X, click &ldquo;Submit tweet&rdquo;, and paste your tweet link to claim <strong>+50 wake points</strong>.
            </p>
          </div>
          <div className="task-info-card">
            <span className="task-info-badge quest">✦ Awakening Quests</span>
            <p>
              Complete the quests below to push the meter into <strong>FCFS (600 pts)</strong> and <strong>Guaranteed (1,500 pts)</strong> mint tiers before Nyx awakes!
            </p>
          </div>
        </div>
      )}

      {/* 3. TASK LIST */}
      <div className="task-list-wrap">
        {tasks.map((t) => {
          const isDone =
            t.id === 'referral'
              ? !!safeTasksDone.referral || (typeof referralsCount === 'number' && referralsCount > 0)
              : !!safeTasksDone[t.id];
          const remainingSec = activeTimers[t.id];
          const isVerifying = typeof remainingSec === 'number' && remainingSec > 0;

          return (
            <div
              key={t.id}
              className="task-row"
              onClick={() => {
                if (!isDone && !isVerifying) {
                  handleTaskClick(t);
                } else if (t.id === 'referral') {
                  handleTaskClick(t);
                }
              }}
              style={{ cursor: isDone && t.id !== 'referral' ? 'default' : 'pointer' }}
            >
              <div className="task-icon" aria-hidden="true">
                {t.icon}
              </div>
              <div className="task-info">
                <div className="task-title">{t.title}</div>
                <div className="task-pts">
                  {t.id === 'referral' ? '+10 pts / friend' : `+${t.pts} pts`}
                </div>

                {t.id === 'referral' && !isVerifying && (
                  <div className="task-extra">
                    {typeof referralsCount === 'number' && referralsCount > 0 ? (
                      <span>
                        {referralsCount} friend{referralsCount > 1 ? 's' : ''} joined!{' '}
                        <a href="#referrals" className="task-ref-link" onClick={(e) => e.stopPropagation()}>
                          Circle Hub →
                        </a>
                      </span>
                    ) : (
                      <span>Tweets your summon link on X</span>
                    )}
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
                  onClick={(e) => {
                    if (t.id === 'referral') {
                      e.stopPropagation();
                      handleTaskClick(t);
                    }
                  }}
                  title={t.id === 'referral' ? 'Tweet your summon link again' : `${t.title} completed`}
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
                  title={t.id === 'referral' ? 'Tweet summon link on X' : t.intentUrl ? 'Open on X' : 'Complete task'}
                >
                  {t.id === 'referral' || t.intentUrl || t.externalLink ? '↗' : '✓'}
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
