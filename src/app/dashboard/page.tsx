'use client';

import { useState, useEffect, useRef } from 'react';
import Backdrop from '@/components/Backdrop';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import DreamMeter from '@/components/DreamMeter';
import ReferralSection from '@/components/ReferralSection';
import Rituals from '@/components/Rituals';
import Lore from '@/components/Lore';
import AwakenMint from '@/components/AwakenMint';
import Footer from '@/components/Footer';
import SpinModal from '@/components/modals/SpinModal';
import TweetModal from '@/components/modals/TweetModal';
import OnboardingModal from '@/components/modals/OnboardingModal';
import SparkleBurst from '@/components/SparkleBurst';
import { useDreamState, FCFS_END } from '@/hooks/useDreamState';

const REPROMPT_DELAY_MS = 10_000; // 10 seconds

export default function Home() {
  const {
    state,
    isLoaded,
    isConnecting,
    connectError,
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
    pct,
    stage,
  } = useDreamState();

  const [spinOpen, setSpinOpen] = useState(false);
  const [tweetOpen, setTweetOpen] = useState(false);
  const [remainingSpinMs, setRemainingSpinMs] = useState(0);
  const [sparkleKey, setSparkleKey] = useState(0);

  // Onboarding modal
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [isReprompt, setIsReprompt] = useState(false);
  const dismissedAtRef = useRef<number | null>(null);
  const repromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userDisconnectedRef = useRef(false);
  const hasInitialPromptedRef = useRef(false);

  // Sync spin cooldown countdown
  useEffect(() => {
    if (!isLoaded) return;
    setRemainingSpinMs(getRemainingSpinMs());
    const interval = setInterval(() => {
      setRemainingSpinMs(getRemainingSpinMs());
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoaded, getRemainingSpinMs]);

  // Onboarding: fire 1.5s after load ONCE if wallet not connected (never right after user manually disconnects)
  useEffect(() => {
    if (!isLoaded) return;
    if (state.walletAddress || hasInitialPromptedRef.current || userDisconnectedRef.current) return;
    hasInitialPromptedRef.current = true;
    const t = setTimeout(() => {
      setIsReprompt(false);
      setOnboardOpen(true);
    }, 1500);
    return () => clearTimeout(t);
  }, [isLoaded, state.walletAddress]);

  const handleOnboardClose = () => {
    if (state.walletAddress || userDisconnectedRef.current) {
      // Fully authed or user intentionally logged out - dismiss permanently
      setOnboardOpen(false);
      if (repromptTimerRef.current) clearTimeout(repromptTimerRef.current);
      return;
    }
    // Not yet authed - re-fire in 10 seconds
    setOnboardOpen(false);
    dismissedAtRef.current = Date.now();
    if (repromptTimerRef.current) clearTimeout(repromptTimerRef.current);
    repromptTimerRef.current = setTimeout(() => {
      if (!userDisconnectedRef.current) {
        setIsReprompt(true);
        setOnboardOpen(true);
      }
    }, REPROMPT_DELAY_MS);
  };

  // Cleanup reprompt timer on unmount
  useEffect(() => {
    return () => {
      if (repromptTimerRef.current) clearTimeout(repromptTimerRef.current);
    };
  }, []);

  // Check for FCFS milestone celebration
  useEffect(() => {
    if (!isLoaded) return;
    if (state.points >= FCFS_END && !state.fcfsCelebrated) {
      markFcfsCelebrated();
      setSparkleKey((k) => k + 1);
    }
  }, [isLoaded, state.points, state.fcfsCelebrated, markFcfsCelebrated]);

  const handleTaskComplete = (taskId: string, pts: number) => {
    completeTask(taskId, pts);
    setSparkleKey((k) => k + 1);
  };

  const handleSpinWin = (pts: number) => {
    spinWheel(pts);
    setSparkleKey((k) => k + 1);
  };

  const handleTweetSubmit = async (url: string) => {
    const res = await submitTweet(url);
    if (res.success) {
      setSparkleKey((k) => k + 1);
    }
    return res;
  };

  const handleRedeemReferral = async (code: string) => {
    const res = await redeemReferralCode(code);
    if (res.success) {
      setSparkleKey((k) => k + 1);
    }
    return res;
  };

  const handleSimulateReferral = async () => {
    const res = await simulateFriendReferral();
    if (res.success) {
      setSparkleKey((k) => k + 1);
    }
    return res;
  };

  const handleDisconnect = () => {
    userDisconnectedRef.current = true;
    if (repromptTimerRef.current) {
      clearTimeout(repromptTimerRef.current);
      repromptTimerRef.current = null;
    }
    setOnboardOpen(false);
    disconnectWallet();
  };

  const handleConnect = async (turnstileToken?: string) => {
    userDisconnectedRef.current = false;
    const res = await connectAndSignWallet({ turnstileToken });
    if (res.success) {
      setSparkleKey((k) => k + 1);
    }
    return res;
  };

  return (
    <>
      <Backdrop glowPct={pct} />
      <SparkleBurst triggerKey={sparkleKey} />

      <Navbar
        walletAddress={state.walletAddress}
        isConnecting={isConnecting}
        onConnectWallet={handleConnect}
        onDisconnectWallet={handleDisconnect}
      />

      <main>
        {/* 1. Cinematic Summons Hero with Task List on the Left of the Image */}
        <Hero
          points={state.points}
          pct={pct}
          tasksDone={state.tasksDone}
          onCompleteTask={handleTaskComplete}
          referralCode={state.referralCode}
          referralsCount={state.referralsCount || 0}
          onConnectWallet={handleConnect}
          onConnectTwitter={() => setOnboardOpen(true)}
          onOpenSpin={() => setSpinOpen(true)}
          onOpenTweet={() => setTweetOpen(true)}
        />

        {/* 2. THE BIG DREAM METER (ON TOP) */}
        <DreamMeter points={state.points} pct={pct} stage={stage} />

        {/* 3. Extra Rituals (Spin & Summons) - Positioned higher directly under meter */}
        <Rituals
          onOpenSpin={() => setSpinOpen(true)}
          onOpenTweet={() => setTweetOpen(true)}
          remainingSpinMs={remainingSpinMs}
          isTweetClaimed={state.tweetClaimed}
        />

        {/* 4. Full Referral Circle System */}
        <ReferralSection
          walletAddress={state.walletAddress}
          referralCode={state.referralCode}
          referralsCount={state.referralsCount || 0}
          referralPoints={state.referralPoints || 0}
          referredByCode={state.referredByCode}
          referralHistory={state.referralHistory || []}
          isConnecting={isConnecting}
          connectError={connectError}
          onConnectAndSign={handleConnect}
          onRedeemCode={handleRedeemReferral}
          onSimulateReferral={handleSimulateReferral}
        />

        {/* 5. The Myth & Cycle */}
        <Lore />

        {/* 6. Awaken Mint & Whitelist Claim */}
        <AwakenMint
          points={state.points}
          walletAddress={state.walletAddress}
          onConnectWallet={handleConnect}
        />

        {/* 7. Footer */}
        <Footer />
      </main>

      <SpinModal
        isOpen={spinOpen}
        onClose={() => setSpinOpen(false)}
        onSpinWin={handleSpinWin}
        remainingMs={remainingSpinMs}
      />

      <TweetModal
        isOpen={tweetOpen}
        onClose={() => setTweetOpen(false)}
        onSubmitTweet={handleTweetSubmit}
        isClaimed={state.tweetClaimed}
      />

      <OnboardingModal
        isOpen={onboardOpen}
        isReprompt={isReprompt}
        onClose={handleOnboardClose}
        walletAddress={state.walletAddress}
        isConnecting={isConnecting}
        connectError={connectError}
        onConnectWallet={handleConnect}
        onConnectTwitter={connectTwitter}
        onCompleteTask={handleTaskComplete}
        twitterDone={!!state.tasksDone?.connectx}
        twitterHandle={state.twitterHandle}
        onRedeemCode={handleRedeemReferral}
      />


    </>
  );
}
