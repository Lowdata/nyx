export interface TaskItem {
  id: string;
  icon: string;
  title: string;
  pts: number;
  description?: string;
  intentUrl?: string;
  externalLink?: string;
  type?: 'twitter_intent' | 'wallet' | 'referral' | 'social';
  order?: number;
  active?: boolean;
  onComplete?: (code?: string) => void;
}

export interface UserTaskRecord {
  address: string;
  taskId: string;
  pts: number;
  completedAt: number;
  metadata?: Record<string, unknown>;
}

export interface ReferralHistoryItem {
  id: string;
  address: string;
  timestamp: number;
  pts: number;
}

export interface DreamState {
  points: number;
  tasksDone: Record<string, boolean>;
  tweetClaimed: boolean;
  submittedTweetUrls: string[];
  lastSpinAt: number | null;
  fcfsCelebrated: boolean;
  referralCode: string | null;
  walletAddress: string | null;
  referralsCount: number;
  referralPoints: number;
  referredByCode: string | null;
  referralHistory: ReferralHistoryItem[];
}

export type DreamStage = 'Deep sleep' | 'Stirring' | 'Dawn breaking' | 'Fully awake';

