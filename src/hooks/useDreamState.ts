'use client';

import { useState, useEffect, useCallback } from 'react';
import { DreamState, DreamStage } from '@/types';

export const TARGET = 2200;
export const SLEEP_END = 600;
export const FCFS_END = 1100;
export const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const STORAGE_KEY = 'nyx_dream_state_v2';
const SESSION_TOKEN_KEY = 'nyx_session_token_v1';

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
  referralsCount: 0,
  referralPoints: 0,
  referredByCode: null,
  referralHistory: [],
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

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
      isMetaMask?: boolean;
    };
  }
}

export function useDreamState() {
  const [state, setState] = useState<DreamState>(DEFAULT_STATE);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Load state and session token from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({
          ...prev,
          ...parsed,
          tasksDone: { ...DEFAULT_STATE.tasksDone, ...(parsed.tasksDone || {}) },
          referralHistory: parsed.referralHistory || [],
        }));
      }

      const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);
      if (savedToken) {
        setSessionToken(savedToken);
      }
    } catch {
      // Ignore localStorage errors
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
        // Fallback
      }
      return next;
    });
  }, []);

  // Connect and Sign Wallet: Authentic Web3 or Testnet Demo fallback
  const connectAndSignWallet = useCallback(async (options?: { isDemo?: boolean }): Promise<{ success: boolean; error?: string }> => {
    setIsConnecting(true);
    setConnectError(null);

    // Check for pending URL invite code
    let refCodeFromUrl: string | undefined;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('ref');
      if (r) refCodeFromUrl = r.trim().toUpperCase();
    }

    try {
      let address: string;
      let signature = '';
      let message = '';
      const isDemo = !!options?.isDemo || (!window.ethereum && typeof window !== 'undefined');

      if (!isDemo && window.ethereum) {
        // 1. Request Ethereum account
        const accounts = (await window.ethereum.request({
          method: 'eth_requestAccounts',
        })) as string[];

        if (!accounts || accounts.length === 0) {
          throw new Error('No account selected');
        }
        address = accounts[0];

        // 2. Build authentication summon message with anti-replay nonce
        const nonce = Math.random().toString(36).substring(2, 12);
        const timestamp = Date.now();
        message = `Nyx — Wake the God of Sleep\n\nSign this message to authenticate your wallet and summon your dream circle.\n\nWallet: ${address.toLowerCase()}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

        // 3. Request personal_sign
        signature = (await window.ethereum.request({
          method: 'personal_sign',
          params: [message, address],
        })) as string;
      } else {
        // Demo mode: strictly generate a demo address prefixed with 0xdemo_
        const randomHex = Math.random().toString(16).substring(2, 8);
        address = `0xdemo_${randomHex}${Date.now().toString(16).slice(-6)}`;
        signature = `0x_demo_sig_${Date.now()}`;
        message = `Nyx Demo Authentication for ${address}`;
      }

      // 4. Send to backend MongoDB authentication
      const res = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          signature,
          message,
          refCode: refCodeFromUrl,
          isDemo,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Save HMAC session token securely
      if (data.sessionToken) {
        setSessionToken(data.sessionToken);
        try {
          localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
        } catch {
          // localStorage fallback
        }
      }

      const user = data.user;
      saveState((prev) => ({
        ...prev,
        walletAddress: user.address,
        referralCode: user.referralCode,
        points: Math.min(TARGET, Math.max(prev.points, user.points)),
        tasksDone: {
          ...prev.tasksDone,
          ...user.tasksDone,
          connect: true,
        },
        referralsCount: user.referralsCount || prev.referralsCount || 0,
        referralPoints: user.referralPoints || prev.referralPoints || 0,
        referredByCode: user.referredByCode || prev.referredByCode,
        referralHistory: user.referralHistory || prev.referralHistory || [],
      }));

      setIsConnecting(false);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Wallet sign rejected or failed';
      setConnectError(msg);
      setIsConnecting(false);
      return { success: false, error: msg };
    }
  }, [saveState]);

  const disconnectWallet = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    } catch {}
    setSessionToken(null);
    setConnectError(null);
    saveState((prev) => ({
      ...prev,
      walletAddress: null,
      referralCode: null,
      referralsCount: 0,
      referralPoints: 0,
      referredByCode: null,
      referralHistory: [],
      tasksDone: {
        ...prev.tasksDone,
        connect: false,
      },
    }));
  }, [saveState]);

  const addPoints = useCallback((n: number) => {
    saveState((prev) => ({
      ...prev,
      points: Math.min(TARGET, prev.points + n),
    }));
  }, [saveState]);

  const completeTask = useCallback((taskId: string, pts: number) => {
    saveState((prev) => {
      if (prev.tasksDone[taskId]) return prev;
      const nextPoints = Math.min(TARGET, prev.points + pts);

      // Async sync to MongoDB tasks completion route with Session Token
      if (prev.walletAddress && sessionToken) {
        fetch('/api/tasks/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            address: prev.walletAddress,
            taskId,
          }),
        }).catch(() => {
          // Fallback sync
          fetch('/api/user/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              address: prev.walletAddress,
              taskId,
              taskPts: pts,
            }),
          }).catch(() => {});
        });
      }

      return {
        ...prev,
        points: nextPoints,
        tasksDone: {
          ...prev.tasksDone,
          [taskId]: true,
        },
      };
    });
  }, [saveState, sessionToken]);

  const spinWheel = useCallback((wonPoints: number) => {
    saveState((prev) => {
      const nextPoints = Math.min(TARGET, prev.points + wonPoints);
      if (prev.walletAddress && sessionToken) {
        fetch('/api/user/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            address: prev.walletAddress,
            spinPoints: wonPoints,
          }),
        }).catch(() => {});
      }

      return {
        ...prev,
        lastSpinAt: Date.now(),
        points: nextPoints,
      };
    });
  }, [saveState, sessionToken]);

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

    saveState((prev) => {
      if (prev.walletAddress && sessionToken) {
        fetch('/api/user/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            address: prev.walletAddress,
            tweetUrl: trimmed,
          }),
        }).catch(() => {});
      }

      return {
        ...prev,
        tweetClaimed: true,
        submittedTweetUrls: [...prev.submittedTweetUrls, trimmed],
        points: Math.min(TARGET, prev.points + 50),
      };
    });

    return { success: true };
  }, [state.tweetClaimed, state.submittedTweetUrls, saveState, sessionToken]);

  const redeemReferralCode = useCallback(
    async (code: string): Promise<{ success: boolean; message: string }> => {
      const cleanCode = code.trim().toUpperCase();
      if (!cleanCode) {
        return { success: false, message: 'Please enter a valid invite code.' };
      }
      if (state.referredByCode) {
        return {
          success: false,
          message: `You have already claimed invite code ${state.referredByCode}.`,
        };
      }
      if (state.referralCode && cleanCode === state.referralCode.toUpperCase()) {
        return { success: false, message: 'You cannot use your own referral code.' };
      }

      // If wallet is connected, call backend MongoDB redeem with Session Token
      if (state.walletAddress && sessionToken) {
        try {
          const res = await fetch('/api/referrals/redeem', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              address: state.walletAddress,
              code: cleanCode,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            return { success: false, message: data.error || 'Failed to claim code' };
          }
        } catch {
          // Network failure fallback
        }
      }

      saveState((prev) => ({
        ...prev,
        referredByCode: cleanCode,
        points: Math.min(TARGET, prev.points + 100),
      }));

      return {
        success: true,
        message: `Welcome bonus unlocked! +100 wake points added from ${cleanCode}.`,
      };
    },
    [state.referredByCode, state.referralCode, state.walletAddress, sessionToken, saveState]
  );

  const simulateFriendReferral = useCallback(async (): Promise<{ success: boolean; pts: number; address: string }> => {
    const randomHex = Math.random().toString(16).substring(2, 6);
    let mockAddress = `0x${randomHex}...${Math.random().toString(16).substring(2, 6)}`;
    const ptsAwarded = 100;

    if (state.walletAddress && sessionToken) {
      try {
        const res = await fetch('/api/referrals/simulate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ address: state.walletAddress }),
        });
        const data = await res.json();
        if (data.success && data.address) {
          mockAddress = data.address;
        }
      } catch {
        // Fallback to local
      }
    }

    saveState((prev) => {
      const newCount = (prev.referralsCount || 0) + 1;
      const newReferralPts = (prev.referralPoints || 0) + ptsAwarded;
      const historyItem = {
        id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        address: mockAddress,
        timestamp: Date.now(),
        pts: ptsAwarded,
      };

      return {
        ...prev,
        referralsCount: newCount,
        referralPoints: newReferralPts,
        points: Math.min(TARGET, prev.points + ptsAwarded),
        referralHistory: [historyItem, ...(prev.referralHistory || [])].slice(0, 10),
      };
    });

    return { success: true, pts: ptsAwarded, address: mockAddress };
  }, [state.walletAddress, sessionToken, saveState]);

  const markFcfsCelebrated = useCallback(() => {
    saveState((prev) => ({ ...prev, fcfsCelebrated: true }));
  }, [saveState]);

  const resetState = useCallback(() => {
    saveState(() => DEFAULT_STATE);
  }, [saveState]);

  return {
    state,
    sessionToken,
    isLoaded,
    isConnecting,
    connectError,
    addPoints,
    completeTask,
    connectAndSignWallet,
    disconnectWallet,
    redeemReferralCode,
    simulateFriendReferral,
    spinWheel,
    getRemainingSpinMs,
    submitTweet,
    markFcfsCelebrated,
    resetState,
    pct: getPercentage(state.points),
    stage: getStage(state.points),
  };
}
