'use client';

import { useState, useEffect, useRef } from 'react';
import { TaskItem } from '@/types';

interface TaskCardProps {
  tasksDone?: Record<string, boolean>;
  onCompleteTask: (taskId: string, pts: number) => Promise<unknown> | void;
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
    intentUrl: 'https://twitter.com/intent/like?tweet_id=2102045565823401990',
  },
  {
    id: 'repost',
    icon: '↻',
    title: 'Retweet the Tweet',
    pts: 30,
    type: 'twitter_intent',
    intentUrl: 'https://twitter.com/intent/retweet?tweet_id=2102045565823401990',
  },
  {
    id: 'comment',
    icon: '💬',
    title: 'Tweet about Nyx',
    pts: 30,
    type: 'twitter_intent',
    intentUrl: 'https://twitter.com/intent/tweet?text=Awakening%20with%20%40enternyx%20%F0%9F%8C%99%20Enter%20the%20dream%20circle%20and%20claim%20your%20wake%20points%3A%20https%3A%2F%2Fnyx.town&in_reply_to=2102045565823401990',
  },
  {
    id: 'post_traits',
    icon: '✦',
    title: 'Like & Repost new post',
    pts: 30,
    type: 'twitter_intent',
    intentUrl: 'https://x.com/enternyx/status/2102413857499095209',
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
  const [verifyingTasks, setVerifyingTasks] = useState<Record<string, boolean>>({});
  const [showInfo, setShowInfo] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; isError: boolean } | null>(null);
  const [, setCopiedLink] = useState<string | null>(
    referralCode ? `https://nyx.gg/?ref=${referralCode}` : null
  );

  const tasksRef = useRef<TaskItem[]>(tasks);
  const onCompleteRef = useRef(onCompleteTask);
  const timeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, isError = false) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setFeedbackToast({ message, isError });
    toastTimeoutRef.current = setTimeout(() => setFeedbackToast(null), 4500);
  };

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    onCompleteRef.current = onCompleteTask;
  }, [onCompleteTask]);

  // Clean up all pending timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach(clearTimeout);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

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

  // 2. User clicks any task: immediate action redirect/copy + reliable background verification
  const handleTaskClick = (task: TaskItem) => {
    if (task.id !== 'referral' && safeTasksDone[task.id]) return;
    if (verifyingTasks[task.id]) return;

    // Guard: Prevent unauthenticated users from running quests without saving
    if (task.id !== 'connect' && !safeTasksDone.connect) {
      showToast('Please connect and sign your wallet first to begin quest rituals.', true);
      if (onConnectWallet) onConnectWallet();
      return;
    }

    // Direct Action Execution
    if (task.id === 'connect') {
      if (onConnectWallet) onConnectWallet();
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
      showToast('Summon link copied! Share on X to earn circle wake points.');
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

    // Show circular verification spinner immediately
    setVerifyingTasks((prev) => ({ ...prev, [task.id]: true }));

    if (timeoutsRef.current[task.id]) {
      clearTimeout(timeoutsRef.current[task.id]);
    }

    // Start 7-second completion timer that reliably triggers onCompleteTask
    timeoutsRef.current[task.id] = setTimeout(async () => {
      try {
        console.log(`[TaskCard] Verification complete for "${task.id}". Calling onCompleteTask...`);
        const res = await onCompleteRef.current(task.id, task.pts);
        if (res && typeof res === 'object' && 'success' in res && !(res as { success: boolean }).success) {
          const errMsg = (res as { error?: string }).error || `Could not verify ${task.title}.`;
          showToast(errMsg, true);
        } else {
          showToast(`✦ ${task.title} verified! +${task.pts} wake points added!`, false);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `Failed to verify ${task.title}.`;
        console.error(`[TaskCard] Error completing task "${task.id}":`, err);
        showToast(msg, true);
      } finally {
        setVerifyingTasks((prev) => {
          const next = { ...prev };
          delete next[task.id];
          return next;
        });
        delete timeoutsRef.current[task.id];
      }
    }, 7000);
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

      {/* FEEDBACK TOAST */}
      {feedbackToast && (
        <div
          className={`task-toast ${feedbackToast.isError ? 'task-toast-error' : 'task-toast-success'} animate-fade-in`}
          style={{
            margin: '0.4rem 1rem 0.6rem',
            padding: '0.55rem 0.85rem',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedbackToast.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            border: feedbackToast.isError ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(34, 197, 94, 0.35)',
            color: feedbackToast.isError ? '#fca5a5' : '#86efac',
          }}
        >
          <span>{feedbackToast.message}</span>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '0.85rem',
              padding: '0 0.25rem',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. TASK LIST */}
      <div className="task-list-wrap">
        {tasks.map((t) => {
          const isDone =
            t.id === 'referral'
              ? !!safeTasksDone.referral || (typeof referralsCount === 'number' && referralsCount > 0)
              : !!safeTasksDone[t.id];
          const isVerifying = !!verifyingTasks[t.id];

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
