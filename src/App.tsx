import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { GameBoard } from './components/GameBoard';
import { PodiumScoreboard } from './components/PodiumScoreboard';
import { SoundboardFooter } from './components/SoundboardFooter';
import { ClueModal } from './components/ClueModal';
import { DeckBuilder } from './components/DeckBuilder';
import { MobileBuzzerView } from './components/MobileBuzzerView';
import { JoinQrModal } from './components/JoinQrModal';
import { BuzzerQueueModal } from './components/BuzzerQueueModal';
import { Category, Clue, Team, StagingClue, BuzzerEvent } from './types/game';
import { INITIAL_CATEGORIES, INITIAL_TEAMS, INITIAL_STAGING_BUFFER, MAX_TEAMS } from './data/defaultDeck';
import {
  openClue, startRound, extendRound, markWrong, releaseBuzzer, closeClue, sendBuzz, loadRoomCode,
  loadPlayerId, loadTimerSeconds, joinTeam, renameTeam, publishTeams, MIN_TIMER_SECONDS, MAX_TIMER_SECONDS,
  type JoinOutcome,
} from './utils/realtime';
import { useRoomSync } from './utils/useRoomSync';

export default function App() {
  // Check URL parameters for mode
  const initialMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'buzzer'
    ? 'buzzer'
    : 'board';

  // A phone that opened the join link: show only the buzzer, never the host controls
  const isPhoneDevice = initialMode === 'buzzer';
  const [playerId] = useState<string>(loadPlayerId);

  const [currentView, setCurrentView] = useState<'board' | 'builder' | 'buzzer'>(initialMode);
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('jeopardy_categories');
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  const [teams, setTeams] = useState<Team[]>(() => {
    const saved = localStorage.getItem('jeopardy_teams');
    return saved ? JSON.parse(saved) : INITIAL_TEAMS;
  });

  const [stagingBuffer, setStagingBuffer] = useState<StagingClue[]>(() => {
    const saved = localStorage.getItem('jeopardy_staging');
    return saved ? JSON.parse(saved) : INITIAL_STAGING_BUFFER;
  });

  const [roomCode] = useState<string>(loadRoomCode);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [timerSeconds, setTimerSeconds] = useState<number>(loadTimerSeconds);

  // Clue modal state
  const [activeClue, setActiveClue] = useState<Clue | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState<string>('');
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isBuzzerQueueOpen, setIsBuzzerQueueOpen] = useState<boolean>(false);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('jeopardy_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('jeopardy_teams', JSON.stringify(teams));
  }, [teams]);

  useEffect(() => {
    localStorage.setItem('jeopardy_staging', JSON.stringify(stagingBuffer));
  }, [stagingBuffer]);

  const handleChangeTimerSeconds = (seconds: number) => {
    const clamped = Math.min(MAX_TIMER_SECONDS, Math.max(MIN_TIMER_SECONDS, Math.round(seconds) || 0));
    setTimerSeconds(clamped);
    try {
      localStorage.setItem('jeopardy_timer_seconds', String(clamped));
    } catch {
      // storage unavailable: the setting simply won't persist
    }
  };

  // The server owns the round (clock, buzzer lock, who is answering); everything below reads from it
  const isBuzzerView = currentView === 'buzzer';
  const teamsRef = useRef(teams);
  teamsRef.current = teams;
  const { round, answerer, serverOffsetMs, roomInfo, refresh } = useRoomSync({
    roomCode,
    playerId,
    isBuzzerView,
    isPhoneDevice,
    activeClueId: activeClue?.id ?? null,
    setTeams,
    setActiveClue,
    setActiveCategoryName,
  });

  const activeRound = round && activeClue && round.clueId === activeClue.id ? round : null;

  const buzzerQueue = useMemo<BuzzerEvent[]>(() => {
    if (!activeRound || !answerer) return [];
    const team = teams.find((t) => t.id === answerer.teamId);
    return [{
      teamId: answerer.teamId,
      teamName: team?.name ?? answerer.teamId,
      timestamp: answerer.timestamp,
      timeTakenMs: answerer.timeTakenMs,
    }];
  }, [activeRound, answerer, teams]);
  const activeBuzz = buzzerQueue[0] ?? null;

  // Host keeps the room's team list (names + scores) fresh for phones
  const teamsSignature = JSON.stringify(teams.map((t) => [t.id, t.name, t.score, t.emoji]));
  useEffect(() => {
    if (isPhoneDevice || currentView === 'buzzer') return;
    const timer = setTimeout(() => void publishTeams(roomCode, teamsRef.current), 400);
    return () => clearTimeout(timer);
  }, [teamsSignature, roomCode, isPhoneDevice, currentView]);

  // Phone: join a team, optionally naming it
  const handleJoinTeam = useCallback(async (teamId: string, teamName: string): Promise<JoinOutcome> => {
    const outcome = await joinTeam(roomCode, playerId, teamId);
    if (outcome !== 'joined') return outcome;
    const current = teamsRef.current.find((t) => t.id === teamId);
    const cleaned = teamName.trim();
    if (cleaned && cleaned !== current?.name) {
      await renameTeam(roomCode, teamId, cleaned);
      setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name: cleaned } : t)));
    }
    await refresh();
    return 'joined';
  }, [roomCode, playerId, refresh]);

  // A team buzzes (phone tap, or host keyboard / podium). The server decides who won.
  const triggerBuzzer = useCallback(async (teamId: string, timeTakenMs?: number) => {
    if (!activeClue) return;
    await sendBuzz(roomCode, activeClue.id, teamId, timeTakenMs || 0);
    await refresh();
  }, [activeClue, roomCode, refresh]);

  // Host round controls
  const handleOpenClue = (clue: Clue, categoryName: string) => {
    setActiveClue(clue);
    setActiveCategoryName(categoryName);
    void openClue(roomCode, clue, categoryName, teams, timerSeconds * 1000).then(refresh);
  };
  const handleStartRound = useCallback(() => void startRound(roomCode).then(refresh), [roomCode, refresh]);
  const handleExtendRound = useCallback((seconds: number) => void extendRound(roomCode, seconds * 1000).then(refresh), [roomCode, refresh]);
  const handleReleaseBuzzer = useCallback(() => void releaseBuzzer(roomCode).then(refresh), [roomCode, refresh]);

  // Close the dialog without scoring or marking the tile (Esc / close)
  const handleDismissClue = useCallback(() => {
    setActiveClue(null);
    void closeClue(roomCode).then(refresh);
  }, [roomCode, refresh]);

  // Keyboard shortcut listener (Keys 1 - 4 buzz for that team, Esc closes dialogs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (isPhoneDevice || currentView === 'buzzer') return;

      if (e.key === 'Escape') {
        if (activeClue) handleDismissClue();
        setIsQrModalOpen(false);
        setIsBuzzerQueueOpen(false);
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const teamIndex = parseInt(e.key, 10) - 1;
        if (teams[teamIndex]) void triggerBuzzer(teams[teamIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [teams, triggerBuzzer, activeClue, handleDismissClue, isPhoneDevice, currentView]);

  // Host judges the answering team
  const handleAwardScore = (clueId: string, teamId: string, isCorrect: boolean, amount: number) => {
    setTeams((prevTeams) =>
      prevTeams.map((t) => {
        if (t.id === teamId) {
          return {
            ...t,
            score: isCorrect ? t.score + amount : t.score - amount,
            streak: isCorrect ? t.streak + 1 : 0,
          };
        }
        return isCorrect ? { ...t, streak: 0 } : t;
      })
    );

    if (!isCorrect) {
      // Wrong: that team is locked out, the clock resumes and the other teams may buzz
      void markWrong(roomCode, teamId).then(refresh);
      return;
    }

    setCategories((prevCats) =>
      prevCats.map((cat) => ({
        ...cat,
        clues: cat.clues.map((c) =>
          c.id === clueId ? { ...c, state: 'CLAIMED' as const, claimedByTeamId: teamId } : c
        ),
      }))
    );
    setActiveClue(null);
    void closeClue(roomCode).then(refresh);
  };

  // Nobody got it: retire the tile
  const handlePassClue = (clueId: string) => {
    setCategories((prevCats) =>
      prevCats.map((cat) => ({
        ...cat,
        clues: cat.clues.map((c) =>
          c.id === clueId ? { ...c, state: 'PASSED' as const } : c
        ),
      }))
    );
    setActiveClue(null);
    void closeClue(roomCode).then(refresh);
  };

  // Adjust score manually
  const handleAdjustScore = (teamId: string, delta: number) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, score: t.score + delta } : t))
    );
  };

  // Reset entire board state
  const handleResetBoard = () => {
    if (window.confirm('Reset all clue tiles and set every team score and streak back to 0?')) {
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          clues: cat.clues.map((c) => ({
            ...c,
            state: 'AVAILABLE' as const,
            claimedByTeamId: null,
          })),
        }))
      );
      setTeams((prev) => prev.map((t) => ({ ...t, score: 0, streak: 0 })));
      setActiveClue(null);
      void closeClue(roomCode).then(refresh);
    }
  };

  // Add custom team
  const handleAddTeam = () => {
    if (teams.length >= MAX_TEAMS) {
      alert(`This game is set up for ${MAX_TEAMS} teams.`);
      return;
    }
    const teamName = prompt('Enter new team name:');
    if (!teamName) return;
    const emojis = ['🚀', '⚡', '🔥', '👾', '🎯', '🦄', '👑', '🍕'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: teamName,
      score: 0,
      streak: 0,
      emoji: randomEmoji,
      colorClass: 'text-[#c3f400]',
      borderColor: 'border-[#c3f400]',
      textColor: '#c3f400',
    };
    setTeams((prev) => [...prev, newTeam]);
  };

  return (
    <div className="bg-[#0f0d15] text-[#e6e0ec] font-body-md bg-grid-cyber min-h-screen flex flex-col justify-between selection:bg-[#c3f400] selection:text-black">
      {/* Top Navigation Header */}
      {!isPhoneDevice && (
        <Header
          currentView={currentView}
          setCurrentView={setCurrentView}
          roomCode={roomCode}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          onOpenQrModal={() => setIsQrModalOpen(true)}
        />
      )}

      {/* Main View Container */}
      <main className={`w-full ${isPhoneDevice ? 'pt-4' : 'pt-22'} pb-8 px-4 md:px-8 max-w-[1680px] mx-auto flex-1 flex flex-col`}>
        {currentView === 'buzzer' ? (
          <MobileBuzzerView
            roomCode={roomCode}
            teams={teams}
            roomInfo={roomInfo}
            activeClue={activeClue}
            round={activeRound}
            answerer={activeRound ? answerer : null}
            serverOffsetMs={serverOffsetMs}
            soundEnabled={soundEnabled}
            onBuzz={(teamId, timeTakenMs) => void triggerBuzzer(teamId, timeTakenMs)}
            onJoinTeam={handleJoinTeam}
            onBackToBoard={isPhoneDevice ? undefined : () => setCurrentView('board')}
          />
        ) : currentView === 'builder' ? (
          <DeckBuilder
            categories={categories}
            stagingBuffer={stagingBuffer}
            onUpdateCategories={setCategories}
            onUpdateStagingBuffer={setStagingBuffer}
            onLaunchBoard={() => setCurrentView('board')}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* 6-Column Jeopardy Board & HUD */}
            <GameBoard
              categories={categories}
              teams={teams}
              roomCode={roomCode}
              buzzerQueue={buzzerQueue}
              timerSeconds={timerSeconds}
              onChangeTimerSeconds={handleChangeTimerSeconds}
              onSelectClue={handleOpenClue}
              onResetBoard={handleResetBoard}
              onOpenDeckBuilder={() => setCurrentView('builder')}
              onOpenBuzzerQueue={() => setIsBuzzerQueueOpen(true)}
            />

            {/* Podium Scoreboard */}
            <PodiumScoreboard
              teams={teams}
              activeBuzzedTeamId={activeBuzz?.teamId || null}
              onAdjustScore={handleAdjustScore}
              onTriggerBuzzer={(teamId) => void triggerBuzzer(teamId)}
              onAddTeam={handleAddTeam}
            />

            {/* Host Soundboard & Footer */}
            <SoundboardFooter
              teams={teams}
              categories={categories}
              soundEnabled={soundEnabled}
            />
          </div>
        )}
      </main>

      {/* Active Clue Dialog (host only) */}
      {activeClue && currentView !== 'buzzer' && (
        <ClueModal
          clue={activeClue}
          categoryName={activeCategoryName}
          teams={teams}
          round={activeRound}
          answerer={activeRound ? answerer : null}
          serverOffsetMs={serverOffsetMs}
          timerSeconds={timerSeconds}
          soundEnabled={soundEnabled}
          onStart={handleStartRound}
          onExtend={handleExtendRound}
          onClose={handleDismissClue}
          onAwardScore={handleAwardScore}
          onPassClue={handlePassClue}
        />
      )}

      {/* QR Code Phone Join Modal */}
      {isQrModalOpen && (
        <JoinQrModal
          roomCode={roomCode}
          onClose={() => setIsQrModalOpen(false)}
          onOpenMobileView={() => setCurrentView('buzzer')}
        />
      )}

      {/* Buzzer Queue Modal */}
      {isBuzzerQueueOpen && (
        <BuzzerQueueModal
          queue={buzzerQueue}
          teams={teams}
          onClearQueue={handleReleaseBuzzer}
          onSelectTeamToAnswer={() => undefined}
          onClose={() => setIsBuzzerQueueOpen(false)}
        />
      )}
    </div>
  );
}
