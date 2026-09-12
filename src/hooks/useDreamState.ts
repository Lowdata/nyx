'use client';

import { useState, useEffect, useCallback } from 'react';
import { DreamState, DreamStage } from '@/types';

export const TARGET = 2200;
export const SLEEP_END = 600;
export const FCFS_END = 1100;
export const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const STORAGE_KEY = 'nyx_dream_state_v2';

export const DEFAULT_STATE: DreamState = {
  points: 0,
  tasksDone: {
    connect: false,
    connectx: false,
    follow: false,
    like: false,
    repost: false,
    comment: false,
    discord: false,
    referral: false,
  },
  tweetClaimed: false,
  submittedTweetUrls: [],
  lastSpinAt: null,
  fcfsCelebrated: false,
  referralCode: null,
  walletAddress: null,
};

export function getStage(pts: number): DreamStage {
  if (pts >= TARGET) return 'Fully awake';
  if (pts >= FCFS_END) return 'Dawn breaking';
  if (pts >= SLEEP_END) return 'Stirring';
  return 'Deep sleep';
}

export function getPercentage(pts: number): number {
  return Math.min(100, Math.max(0, (pts / TARGET) * 100));
}

export function useDreamState() {
  const [state, setState] = useState<DreamState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({
          ...DEFAULT_STATE,
          ...parsed,
          tasksDone: { ...DEFAULT_STATE.tasksDone, ...(parsed.tasksDone || {}) },
        }));
      }
    } catch {
      // Ignore localStorage errors (private browsing, sandboxed iframes)
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Persist state updates to localStorage
  const saveState = useCallback((updater: (prev: DreamState) => DreamState) => {
    setState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Fallback for storage write failure
      }
      return next;
    });
  }, []);

  const addPoints = useCallback((n: number) => {
    saveState((prev) => ({
      ...prev,
      points: Math.min(TARGET, prev.points + n),
    }));
  }, [saveState]);

  const completeTask = useCallback((taskId: string, pts: number) => {
    saveState((prev) => {
      if (prev.tasksDone[taskId]) return prev;
      return {
        ...prev,
        points: Math.min(TARGET, prev.points + pts),
        tasksDone: {
          ...prev.tasksDone,
          [taskId]: true,
        },
      };
    });
  }, [saveState]);

  const connectWallet = useCallback((address = '0x71C...4f9a') => {
    saveState((prev) => {
      const alreadyDone = prev.tasksDone.connect;
      return {
        ...prev,
        walletAddress: address,
        points: alreadyDone ? prev.points : Math.min(TARGET, prev.points + 150),
        tasksDone: {
          ...prev.tasksDone,
          connect: true,
        },
      };
    });
  }, [saveState]);

  const generateReferralCode = useCallback(() => {
    let code = state.referralCode;
    if (!code) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      saveState((prev) => ({ ...prev, referralCode: code }));
    }
    return code;
  }, [state.referralCode, saveState]);

  const spinWheel = useCallback((wonPoints: number) => {
    saveState((prev) => ({
      ...prev,
      lastSpinAt: Date.now(),
      points: Math.min(TARGET, prev.points + wonPoints),
    }));
  }, [saveState]);

  const getRemainingSpinMs = useCallback((): number => {
    if (!state.lastSpinAt) return 0;
    const elapsed = Date.now() - state.lastSpinAt;
    return Math.max(0, SPIN_COOLDOWN_MS - elapsed);
  }, [state.lastSpinAt]);

  const submitTweet = useCallback((tweetUrl: string): { success: boolean; error?: string } => {
    const trimmed = tweetUrl.trim();
    if (!trimmed) {
      return { success: false, error: 'Paste your tweet link first.' };
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { success: false, error: 'Link must start with https://' };
      }
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (host !== 'twitter.com' && host !== 'x.com') {
        return { success: false, error: 'That doesn’t look like an X or Twitter link.' };
      }
      if (!/\/[^/]+\/status(es)?\/\d+/i.test(parsed.pathname)) {
        return { success: false, error: 'Must be a direct link to an X post (status URL).' };
      }
    } catch {
      return { success: false, error: 'Please enter a valid URL.' };
    }

    if (state.tweetClaimed) {
      return { success: false, error: 'You have already submitted a tweet.' };
    }

    const alreadySubmitted = state.submittedTweetUrls.some(
      (u) => u.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadySubmitted) {
      return { success: false, error: 'This link has already been submitted.' };
    }

    saveState((prev) => ({
      ...prev,
      tweetClaimed: true,
      submittedTweetUrls: [...prev.submittedTweetUrls, trimmed],
      points: Math.min(TARGET, prev.points + 50),
    }));

    return { success: true };
  }, [state.tweetClaimed, state.submittedTweetUrls, saveState]);

  const markFcfsCelebrated = useCallback(() => {
    saveState((prev) => ({ ...prev, fcfsCelebrated: true }));
  }, [saveState]);

  const resetState = useCallback(() => {
    saveState(() => DEFAULT_STATE);
  }, [saveState]);

  return {
    state,
    isLoaded,
    addPoints,
    completeTask,
    connectWallet,
    generateReferralCode,
    spinWheel,
    getRemainingSpinMs,
    submitTweet,
    markFcfsCelebrated,
    resetState,
    pct: getPercentage(state.points),
    stage: getStage(state.points),
  };
}
