export interface Clue {
  id: string;
  category: string;
  value: number; // 200, 400, 600, 800, 1000
  question: string;
  answer: string;
  isDailyDouble?: boolean;
  claimedByTeamId?: string | null;
  state: 'AVAILABLE' | 'ACTIVE' | 'CLAIMED' | 'PASSED';
}

export interface Category {
  id: string;
  code: string; // CAT 01, CAT 02, etc.
  name: string;
  subtitle: string;
  icon: string;
  colorTheme: string;
  clues: Clue[];
}

export interface Team {
  id: string;
  name: string;
  score: number;
  streak: number;
  emoji: string;
  colorClass: string;
  borderColor: string;
  textColor: string;
}

export interface BuzzerEvent {
  teamId: string;
  teamName: string;
  timestamp: number;
  timeTakenMs?: number;
}

export interface StagingClue {
  id: string;
  source: string; // e.g. "Slide #4 (pptx)"
  question: string;
  answer: string;
  suggestedValue: number;
  suggestedCategory?: string;
}

export interface GameSettings {
  round: number;
  roundName: string;
  roomCode: string;
  timerDuration: number; // in seconds, default 8
  soundEffectsEnabled: boolean;
  autoSeedEnabled: boolean;
  stakeBalancingEnabled: boolean;
}
