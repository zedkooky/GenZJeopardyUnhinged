import React, { useState } from 'react';
import { X, Copy, Check, Smartphone, QrCode } from 'lucide-react';

interface JoinQrModalProps {
  roomCode: string;
  onClose: () => void;
  onOpenMobileView: () => void;
}

export const JoinQrModal: React.FC<JoinQrModalProps> = ({
  roomCode,
  onClose,
  onOpenMobileView,
}) => {
  const [copied, setCopied] = useState(false);
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}?mode=buzzer&room=${encodeURIComponent(roomCode)}` : `?mode=buzzer&room=${encodeURIComponent(roomCode)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0d15]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#211e27] p-6 rounded-2xl shadow-[8px_8px_0_#000000] border-2 border-[#c3f400] flex flex-col gap-5 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#c3f400] flex items-center justify-center text-black shadow-[2px_2px_0_#000000]">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-space text-lg font-bold uppercase text-white">
              Connect Phones as Buzzers
            </h3>
            <p className="font-space text-xs text-[#ccc3d8]">
              Scan QR code or open buzzer link on any smartphone
            </p>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="bg-white p-6 rounded-xl flex flex-col items-center justify-center shadow-inner border-2 border-black">
          {/* Stylized high-res QR code image or generated SVG */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}&color=0f0d15`}
            alt="Room Buzzer QR Code"
            className="w-48 h-48 object-contain"
            onError={(e) => {
              // Fallback if network blocked
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="mt-3 text-center">
            <span className="font-space text-xs font-bold uppercase text-black">
              Room Code: <strong className="text-[#7c3aed] text-base">{roomCode}</strong>
            </span>
          </div>
        </div>

        {/* Join Link Copy Box */}
        <div className="flex items-center gap-2 bg-[#0f0d15] p-2.5 rounded-xl border border-white/10">
          <input
            type="text"
            readOnly
            value={joinUrl}
            className="bg-transparent text-white font-space text-xs w-full focus:outline-none select-all truncate"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1 bg-[#c3f400] text-black font-space text-xs font-bold uppercase rounded-lg hover:bg-[#abd600] active:translate-x-0.5 active:translate-y-0.5 transition-all flex-shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Direct Open Button */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenMobileView();
          }}
          className="w-full py-2.5 bg-[#7c3aed] hover:bg-[#9353ff] text-white font-space text-xs font-bold uppercase rounded-xl shadow-[4px_4px_0_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center"
        >
          📱 Switch This Screen to Phone Buzzer View
        </button>
      </div>
    </div>
  );
};
