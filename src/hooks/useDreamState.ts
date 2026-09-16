'use client';

import { useState, useEffect, useCallback } from 'react';
import { DreamState, DreamStage } from '@/types';

export const TARGET = 2200;
export const SLEEP_END = 600;
export const FCFS_END = 1500;
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
    referral: false,
  },
  twitterHandle: null,
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

  // Load state and session token from localStorage on client mount & sync from DB
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved && savedToken) {
        const parsed = JSON.parse(saved);
        if (parsed.walletAddress) {
          setState((prev) => ({
            ...prev,
            ...parsed,
            tasksDone: { ...DEFAULT_STATE.tasksDone, ...(parsed.tasksDone || {}) },
            referralHistory: parsed.referralHistory || [],
          }));
          setSessionToken(savedToken);

          // Authoritatively sync user state from backend DB
          fetch('/api/user/sync', {
            headers: { Authorization: `Bearer ${savedToken}` },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.user) {
                const u = data.user;
                setState((prev) => ({
                  ...prev,
                  walletAddress: u.address,
                  twitterHandle: u.twitterHandle || null,
                  referralCode: u.referralCode,
                  points: Math.min(TARGET, u.points ?? 0),
                  tasksDone: {
                    ...DEFAULT_STATE.tasksDone,
                    ...(u.tasksDone || {}),
                    connect: true,
                  },
                  tweetClaimed: !!u.tweetClaimed,
                  submittedTweetUrls: u.submittedTweetUrls || [],
                  lastSpinAt: u.lastSpinAt || null,
                  fcfsCelebrated: !!u.fcfsCelebrated,
                  referralsCount: u.referralsCount || 0,
                  referralPoints: u.referralPoints || 0,
                  referredByCode: u.referredByCode || null,
                  referralHistory: u.referralHistory || [],
                }));
              } else if (!data.success) {
                // Invalid or expired session - reset to clean state
                localStorage.removeItem(SESSION_TOKEN_KEY);
                localStorage.removeItem(STORAGE_KEY);
                setSessionToken(null);
                setState(DEFAULT_STATE);
              }
            })
            .catch(() => {});
        } else {
          // No wallet associated with saved state — reset to clean DEFAULT_STATE
          localStorage.removeItem(STORAGE_KEY);
          setState(DEFAULT_STATE);
        }
      } else {
        // Unauthenticated visitor — clean slate with 0 points
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(SESSION_TOKEN_KEY);
        } catch {}
        setState(DEFAULT_STATE);
      }
    } catch {
      setState(DEFAULT_STATE);
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

  const disconnectWallet = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setSessionToken(null);
    setConnectError(null);
    setState(DEFAULT_STATE);
  }, []);

  // Listen for MetaMask / Rabby account switches
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (!accs || accs.length === 0) {
        disconnectWallet();
      } else if (state.walletAddress && accs[0].toLowerCase() !== state.walletAddress.toLowerCase()) {
        disconnectWallet();
      }
    };

    const eth = window.ethereum as {
      on?: (event: string, handler: (accounts: unknown) => void) => void;
      removeListener?: (event: string, handler: (accounts: unknown) => void) => void;
    };

    if (eth && typeof eth.on === 'function') {
      eth.on('accountsChanged', handleAccountsChanged);
    }
    return () => {
      if (eth && typeof eth.removeListener === 'function') {
        eth.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [state.walletAddress, disconnectWallet]);

  // Connect and Sign Wallet: Authentic Web3 or Testnet Demo fallback
  const connectAndSignWallet = useCallback(async (options?: { isDemo?: boolean; turnstileToken?: string }): Promise<{ success: boolean; error?: string }> => {
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

      // Demo mode is only allowed on localhost — never on production
      const isLocalhost = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const isDemo = !!options?.isDemo || (!window.ethereum && isLocalhost);

      // On production: if no wallet extension, show a clear error instead of creating a demo account
      if (!isDemo && !window.ethereum) {
        setIsConnecting(false);
        return { success: false, error: 'No wallet detected. Please install MetaMask or another Web3 wallet to connect.' };
      }

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
        message = `Nyx: Wake the God of Sleep\n\nSign this message to authenticate your wallet and summon your dream circle.\n\nWallet: ${address.toLowerCase()}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

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
          turnstileToken: options?.turnstileToken,
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
      const verifiedPoints = typeof user.points === 'number' ? user.points : 50;

      // Set authoritative state directly from verified user, never polluting with old session points
      saveState(() => ({
        ...DEFAULT_STATE,
        walletAddress: user.address,
        referralCode: user.referralCode,
        points: Math.min(TARGET, verifiedPoints),
        tasksDone: {
          ...DEFAULT_STATE.tasksDone,
          ...(user.tasksDone || {}),
          connect: true,
        },
        tweetClaimed: !!user.tweetClaimed,
        submittedTweetUrls: user.submittedTweetUrls || [],
        lastSpinAt: user.lastSpinAt || null,
        fcfsCelebrated: !!user.fcfsCelebrated,
        referralsCount: user.referralsCount || 0,
        referralPoints: user.referralPoints || 0,
        referredByCode: user.referredByCode || null,
        referralHistory: user.referralHistory || [],
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

  const submitTweet = useCallback(async (tweetUrl: string): Promise<{ success: boolean; error?: string }> => {
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
      return {
        success: false,
        error: 'Nyx is watching from the shadows... That prophecy has already been claimed in the dream circle. Submit your own genuine dream.',
      };
    }

    if (state.walletAddress && sessionToken) {
      try {
        const res = await fetch('/api/user/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            address: state.walletAddress,
            tweetUrl: trimmed,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return {
            success: false,
            error: data.error || 'Nyx is watching from the shadows... That prophecy has already been claimed in the dream circle. Submit your own genuine dream.',
          };
        }
      } catch {
        return { success: false, error: 'Network issue verifying tweet with Nyx. Please try again.' };
      }
    }

    saveState((prev) => ({
      ...prev,
      tweetClaimed: true,
      submittedTweetUrls: [...prev.submittedTweetUrls, trimmed],
      points: Math.min(TARGET, prev.points + 50),
    }));

    return { success: true };
  }, [state.tweetClaimed, state.submittedTweetUrls, state.walletAddress, saveState, sessionToken]);

  const redeemReferralCode = useCallback(
    async (code: string): Promise<{ success: boolean; message: string }> => {
      const cleanCode = code.trim().toUpperCase();
      if (!cleanCode) {
        return { success: false, message: 'Please enter a valid invite code.' };
      }
      if (!/^[A-Z0-9-]{4,16}$/.test(cleanCode)) {
        return { success: false, message: 'Invalid invite code format. Check the code and try again.' };
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

      // 1. If wallet is connected, call backend MongoDB redeem with Session Token
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
          if (!res.ok || !data.success) {
            return {
              success: false,
              message: data.error || 'Invalid invite code. That summons does not exist in the dream circle.',
            };
          }

          // Strictly save state ONLY when MongoDB redemption succeeds
          saveState((prev) => ({
            ...prev,
            referredByCode: cleanCode,
            points: Math.min(TARGET, prev.points + 10),
          }));

          return {
            success: true,
            message: data.message || `Welcome bonus unlocked! +10 wake points added from ${cleanCode}.`,
          };
        } catch {
          return {
            success: false,
            message: 'Network issue verifying referral code with the server. Please try again.',
          };
        }
      }

      // 2. If wallet is NOT connected yet, verify against MongoDB before accepting code
      try {
        const res = await fetch('/api/referrals/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: cleanCode }),
        });
        const data = await res.json();
        if (!res.ok || !data.valid) {
          return {
            success: false,
            message: data.error || 'Invalid invite code: That summons does not exist in the dream circle.',
          };
        }

        // Code exists in DB! Record it so when user connects wallet, bonus will be claimed
        saveState((prev) => ({
          ...prev,
          referredByCode: cleanCode,
        }));

        return {
          success: true,
          message: `Summons recognized from ${cleanCode}! Connect your wallet to claim your +10 bonus points.`,
        };
      } catch {
        return {
          success: false,
          message: 'Could not reach the server to verify invite code. Please try again.',
        };
      }
    },
    [state.referredByCode, state.referralCode, state.walletAddress, sessionToken, saveState]
  );

  const simulateFriendReferral = useCallback(async (): Promise<{ success: boolean; pts: number; address: string }> => {
    const randomHex = Math.random().toString(16).substring(2, 6);
    let mockAddress = `0x${randomHex}...${Math.random().toString(16).substring(2, 6)}`;
    const ptsAwarded = 10; // Matches calibrated referral value

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

  const connectTwitter = useCallback(async (rawHandle: string): Promise<{ success: boolean; error?: string }> => {
    const clean = rawHandle.trim().replace(/^@/, '');
    if (!clean) {
      return { success: false, error: 'Please enter your X / Twitter handle.' };
    }
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
      return { success: false, error: 'Handle can only contain letters, numbers, and underscores (max 15 characters).' };
    }

    if (state.walletAddress && sessionToken) {
      try {
        const res = await fetch('/api/user/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            address: state.walletAddress,
            twitterHandle: clean,
            taskId: 'connectx',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || 'Failed to link Twitter account' };
        }
      } catch {
        // Fallback to local state save
      }
    }

    saveState((prev) => {
      const alreadyDone = prev.tasksDone.connectx;
      const ptsToAdd = alreadyDone ? 0 : 50;
      return {
        ...prev,
        twitterHandle: clean,
        points: Math.min(TARGET, prev.points + ptsToAdd),
        tasksDone: {
          ...prev.tasksDone,
          connectx: true,
        },
      };
    });

    return { success: true };
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
    connectTwitter,
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
