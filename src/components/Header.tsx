import React from 'react';
import { Volume2, VolumeX, Maximize, Smartphone, QrCode } from 'lucide-react';

interface HeaderProps {
  currentView: 'board' | 'builder' | 'buzzer';
  setCurrentView: (view: 'board' | 'builder' | 'buzzer') => void;
  roomCode: string;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  onOpenQrModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  roomCode,
  soundEnabled,
  setSoundEnabled,
  onOpenQrModal,
}) => {
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0f0d15]/90 backdrop-blur-md border-b-2 border-black shadow-[0_4px_0_#000000]">
      <div className="h-18 w-full px-4 md:px-8 flex items-center justify-between gap-4">
        {/* Brand and Room Tag */}
        <div className="flex items-center gap-3 md:gap-5">
          <button 
            onClick={() => setCurrentView('board')}
            className="flex items-center gap-2.5 text-left group transition-transform active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-[#c3f400] flex items-center justify-center font-bold text-black text-xl shadow-[2px_2px_0_#000000]">
              J!
            </div>
            <span className="font-space font-bold text-lg md:text-xl uppercase tracking-wider text-[#c3f400] drop-shadow-[2px_2px_0px_#000000]">
              Jeopardy! Unhinged
            </span>
          </button>

          <div className="hidden lg:flex items-center bg-[#7c3aed] px-3 py-1 rounded-xl shadow-[2px_2px_0_#000000]">
            <span className="font-space text-xs font-bold uppercase text-[#ede0ff] tracking-widest">
              Round 1: Single Jeopardy
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#2b2932] px-3 py-1 rounded-xl shadow-[2px_2px_0_#000000]">
            <span className="w-2 h-2 rounded-full bg-[#c3f400] animate-ping" />
            <span className="font-space text-xs font-bold text-[#c3f400] tracking-wider uppercase">
              Room: {roomCode}
            </span>
          </div>
        </div>

        {/* View Navigation */}
        <nav className="flex items-center bg-[#1d1a23] p-1 rounded-xl shadow-[2px_2px_0_#000000] border border-white/5">
          <button
            type="button"
            onClick={() => setCurrentView('board')}
            className={`px-3 py-1.5 rounded-lg font-space text-xs md:text-sm font-bold uppercase transition-all ${
              currentView === 'board'
                ? 'bg-[#7c3aed] text-white shadow-[2px_2px_0_#000000]'
                : 'text-[#ccc3d8] hover:text-white'
            }`}
          >
            Live Board
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('builder')}
            className={`px-3 py-1.5 rounded-lg font-space text-xs md:text-sm font-bold uppercase transition-all ${
              currentView === 'builder'
                ? 'bg-[#7c3aed] text-white shadow-[2px_2px_0_#000000]'
                : 'text-[#ccc3d8] hover:text-white'
            }`}
          >
            Deck Builder
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('buzzer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-space text-xs md:text-sm font-bold uppercase transition-all ${
              currentView === 'buzzer'
                ? 'bg-[#c3f400] text-black shadow-[2px_2px_0_#000000]'
                : 'text-[#c3f400] hover:bg-[#c3f400]/10'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Phone Buzzer</span>
          </button>
        </nav>

        {/* Right utility buttons */}
        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-[#211e27] hover:bg-[#2b2932] rounded-xl text-white shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#c3f400]" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#ccc3d8]" />
            )}
          </button>

          {/* QR Code Join Modal */}
          <button
            type="button"
            onClick={onOpenQrModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#211e27] hover:bg-[#2b2932] rounded-xl text-[#c3f400] font-space text-xs font-bold uppercase shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            title="Scan QR to connect phones as buzzers"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden md:inline">Connect Phones</span>
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 bg-[#211e27] hover:bg-[#2b2932] rounded-xl text-white shadow-[2px_2px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            title="Toggle Fullscreen"
          >
            <Maximize className="w-4 h-4 text-[#d2bbff]" />
          </button>

          {/* Host Mode Button */}
          <button
            type="button"
            onClick={() => setCurrentView(currentView === 'board' ? 'builder' : 'board')}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[#c3f400] hover:bg-[#abd600] text-black font-space text-xs font-bold uppercase rounded-xl shadow-[3px_3px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            <span>{currentView === 'board' ? 'Host Deck' : 'Back to Board'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
