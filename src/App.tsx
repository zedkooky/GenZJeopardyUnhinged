import React, { useState, useEffect, useCallback } from 'react';
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
import { INITIAL_CATEGORIES, INITIAL_TEAMS, INITIAL_STAGING_BUFFER } from './data/defaultDeck';
import { playBuzzerSound } from './utils/audio';

export default function App() {
  // Check URL parameters for mode
  const initialMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'buzzer'
    ? 'buzzer'
    : 'board';

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

  const [roomCode] = useState<string>('#SLAY-404');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Clue modal state
  const [activeClue, setActiveClue] = useState<Clue | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState<string>('');

  // Buzzer queue state
  const [buzzerQueue, setBuzzerQueue] = useState<BuzzerEvent[]>([]);
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

  // BroadcastChannel for cross-tab / mobile buzzer synchronization
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('jeopardy_live_room');

    channel.onmessage = (event) => {
      const data = event.data;
      if (data?.type === 'BUZZ') {
        const team = teams.find((t) => t.id === data.teamId);
        if (team) {
          setBuzzerQueue((prev) => {
            if (prev.some((b) => b.teamId === data.teamId)) return prev;
            return [...prev, {
              teamId: data.teamId,
              teamName: team.name,
              timestamp: data.timestamp || Date.now(),
              timeTakenMs: data.timeTakenMs || 350,
            }];
          });
          if (soundEnabled) playBuzzerSound();
        }
      } else if (data?.type === 'CLUE_ACTIVE') {
        setActiveClue(data.clue);
        setActiveCategoryName(data.categoryName);
      } else if (data?.type === 'CLUE_CLOSED') {
        setActiveClue(null);
        setBuzzerQueue([]);
      }
    };

    return () => channel.close();
  }, [teams, soundEnabled]);

  // Trigger buzz for a team
  const triggerBuzzer = useCallback((teamId: string, timeTakenMs?: number) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    // Check if team already in queue
    setBuzzerQueue((prev) => {
      if (prev.some((b) => b.teamId === teamId)) return prev;
      const newEvent: BuzzerEvent = {
        teamId,
        teamName: team.name,
        timestamp: Date.now(),
        timeTakenMs: timeTakenMs || 350,
      };

      // Broadcast to other windows / tabs
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const channel = new BroadcastChannel('jeopardy_live_room');
          channel.postMessage({ type: 'BUZZ', teamId, timeTakenMs: newEvent.timeTakenMs, timestamp: newEvent.timestamp });
          channel.close();
        } catch {
          // ignore
        }
      }

      return [...prev, newEvent];
    });

    if (soundEnabled) {
      playBuzzerSound();
    }
  }, [teams, soundEnabled]);

  // Keyboard shortcut listener (Keys 1 - 4 trigger buzz, Esc closes modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        setActiveClue(null);
        setIsQrModalOpen(false);
        setIsBuzzerQueueOpen(false);
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const teamIndex = parseInt(e.key, 10) - 1;
        if (teams[teamIndex]) {
          triggerBuzzer(teams[teamIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [teams, triggerBuzzer]);

  // Handle Score Award
  const handleAwardScore = (clueId: string, teamId: string, isCorrect: boolean, amount: number) => {
    // 1. Update team score and streak
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

    // 2. Mark clue state
    if (isCorrect) {
      setCategories((prevCats) =>
        prevCats.map((cat) => ({
          ...cat,
          clues: cat.clues.map((c) =>
            c.id === clueId ? { ...c, state: 'CLAIMED' as const, claimedByTeamId: teamId } : c
          ),
        }))
      );
    }

    // 3. Clear buzzers & close modal
    setBuzzerQueue([]);
    setActiveClue(null);
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('jeopardy_live_room');
        channel.postMessage({ type: 'CLUE_CLOSED' });
        channel.close();
      } catch {}
    }
  };

  // Handle Clue Pass
  const handlePassClue = (clueId: string) => {
    setCategories((prevCats) =>
      prevCats.map((cat) => ({
        ...cat,
        clues: cat.clues.map((c) =>
          c.id === clueId ? { ...c, state: 'PASSED' as const } : c
        ),
      }))
    );
    setBuzzerQueue([]);
    setActiveClue(null);
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('jeopardy_live_room');
        channel.postMessage({ type: 'CLUE_CLOSED' });
        channel.close();
      } catch {}
    }
  };

  // Adjust score manually
  const handleAdjustScore = (teamId: string, delta: number) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, score: t.score + delta } : t))
    );
  };

  // Reset entire board state
  const handleResetBoard = () => {
    if (window.confirm('Reset all clue tiles to available and clear team streaks?')) {
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
      setBuzzerQueue([]);
    }
  };

  // Add custom team
  const handleAddTeam = () => {
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

  const activeBuzz = buzzerQueue.length > 0 ? buzzerQueue[0] : null;

  return (
    <div className="bg-[#0f0d15] text-[#e6e0ec] font-body-md bg-grid-cyber min-h-screen flex flex-col justify-between selection:bg-[#c3f400] selection:text-black">
      {/* Top Navigation Header */}
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        roomCode={roomCode}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onOpenQrModal={() => setIsQrModalOpen(true)}
      />

      {/* Main View Container */}
      <main className="w-full pt-22 pb-8 px-4 md:px-8 max-w-[1680px] mx-auto flex-1 flex flex-col">
        {currentView === 'buzzer' ? (
          <MobileBuzzerView
            roomCode={roomCode}
            teams={teams}
            activeClue={activeClue}
            activeBuzz={activeBuzz}
            soundEnabled={soundEnabled}
            onBuzz={(teamId, timeTakenMs) => triggerBuzzer(teamId, timeTakenMs)}
            onBackToBoard={() => setCurrentView('board')}
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
              onSelectClue={(clue, categoryName) => {
                setActiveClue(clue);
                setActiveCategoryName(categoryName);
                setBuzzerQueue([]); // Reset buzzer for this clue
                if (typeof BroadcastChannel !== 'undefined') {
                  try {
                    const channel = new BroadcastChannel('jeopardy_live_room');
                    channel.postMessage({ type: 'CLUE_ACTIVE', clue, categoryName });
                    channel.close();
                  } catch {}
                }
              }}
              onResetBoard={handleResetBoard}
              onOpenDeckBuilder={() => setCurrentView('builder')}
              onOpenBuzzerQueue={() => setIsBuzzerQueueOpen(true)}
            />

            {/* Podium Scoreboard */}
            <PodiumScoreboard
              teams={teams}
              activeBuzzedTeamId={activeBuzz?.teamId || null}
              onAdjustScore={handleAdjustScore}
              onTriggerBuzzer={triggerBuzzer}
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

      {/* Active Clue Dialog */}
      {activeClue && (
        <ClueModal
          clue={activeClue}
          categoryName={activeCategoryName}
          teams={teams}
          activeBuzz={activeBuzz}
          soundEnabled={soundEnabled}
          onClose={() => setActiveClue(null)}
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
          onClearQueue={() => setBuzzerQueue([])}
          onSelectTeamToAnswer={(teamId) => {
            const team = teams.find((t) => t.id === teamId);
            if (team && activeClue) {
              // Active team selected
            }
          }}
          onClose={() => setIsBuzzerQueueOpen(false)}
        />
      )}
    </div>
  );
}
