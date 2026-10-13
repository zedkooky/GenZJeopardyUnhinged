# Jeopardy! Live Arena & Deck Ingestion Studio with Mobile Phone Buzzers

An interactive, high-energy live trivia game show platform modeled on Jeopardy! Play, featuring a 6-column game board, real-time podium scoring, interactive clue reveal modal with timer and judging, a full Deck Builder & Presentation Ingestion Studio with Gemini AI auto-categorization, and a synchronized Mobile Web Buzzer application for live room players.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been synthesized from your responses:

- **Confirmed Ingestion Formats**: Full support for `.pptx` presentation uploads, structured text/notes outlines, CSV files, and quick raw Q&A paste (`Q: [clue] | A: [answer] | Topic: [category]`).
- **Confirmed Mobile Phone Buzzers**: A dedicated responsive Mobile Buzzer Controller view (`/buzzer` or mode toggle with QR code & room code `#SLAY-404`) allowing players to join as any team on their smartphone, receive live lockout state, and smash a high-haptic buzzer with millisecond ranking.
- **Confirmed Gemini AI Integration**: Server-side Gemini 3.8 Flash (`@google/genai`) API integration to ingest slide decks or text notes, intelligently group content into 6 cohesive categories, and balance difficulty stakes ($200 to $1,000).
- **Audio Experience**: Embedded Web Audio API synthesizer for instant zero-latency game sounds (Think Music theme, Wrong Buzzer, Stadium Air Horn, W Applause, and Daily Double chime) requiring zero external media downloads.

---

## 1. Overview & Core Concept

**Jeopardy! Unhinged** provides hosts and players with a dual-screen experience:
1. **Host Live Arena (`Board` & `Podium`)**: A large-screen 6-column game board with dynamic value tiles ($200–$1000), Daily Double triggers, active clue countdown timer (8s), answer reveal mask, team podium score adjustments, buzzer queue resolution, and a host audio FX pad.
2. **Deck Builder & Ingestion Studio (`Deck Builder`)**: Drag-and-drop PowerPoint / presentation file ingestion, raw Q&A text batch parser, Gemini AI category distributor, staging buffer carousel for unassigned clues, and JSON export/import.
3. **Mobile Phone Buzzer Web App (`Mobile Buzzer`)**: An ultra-responsive mobile web interface where attendees join room `#SLAY-404`, select their team (Brat Pack, Certified Yappers, The Sigmas, No Cap Squad, or custom teams), and lock in buzzer hits in real-time.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          HOST WORKSPACE VIEW                           │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ 6-Column Board Grid   │  │ Clue Modal (8s) │  │ Host Soundboard  │  │
│  │ $200 - $1000 Tiles    │  │ Answer Mask &   │  │ Think Music,     │  │
│  │ Daily Double & Claimed│  │ Scoring Actions │  │ Air Horn, W-Clap │  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Podium Scoreboard: Brat Pack ($2400) | Yappers ($1600) | ...     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ Live Buzzer State & Clue Sync
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   MOBILE PHONE BUZZER CONTROLLER                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Room: #SLAY-404 · Team: 💅 Brat Pack · Ping: 12ms               │  │
│  │ [ ACTIVE CLUE: 🗣️ SLANG DICTIONARY · $800 ]                     │  │
│  │                                                                  │  │
│  │                  ┌────────────────────────┐                      │  │
│  │                  │                        │                      │  │
│  │                  │      ⚡ BUZZ IN!       │                      │  │
│  │                  │                        │                      │  │
│  │                  └────────────────────────┘                      │  │
│  │                                                                  │  │
│  │ Status: READY TO BUZZ / BUZZ LOCKED / YOU BUZZED 1ST! (0.42s)    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Experience & Visual Design

### Visual Identity & Theme Tokens
The interface faithfully reproduces the provided neo-brutalist dark cyber game show aesthetic:
- **Dominant Canvas**: Deep obsidian background `#0f0d15` and `#14121a` with an ambient cyber grid (`rgba(124,58,237,0.08) 1px`).
- **Surface Elevation**: Containers with crisp solid 2px/4px hard drop-shadows (`shadow-[4px_4px_0_#000000]`).
- **Vibrant Accent Palette**:
  - Lime / Neon Yellow: `#c3f400` (Leader accents, active live clue outlines, primary CTAs).
  - Electric Violet: `#7c3aed` and `#d2bbff` (Round badges, column highlights, batch tools).
  - Magenta / Crimson: `#bf2076` and `#ffb0cd` (Daily Double tags, timer pulses, alerts).
  - Error Coral: `#ffb4ab` and `#93000a` (Penalty deductions, wrong answer cues).
- **Typography**: `Space Grotesk` for bold display numbers and headers; `Plus Jakarta Sans` for clue readability and metadata.

### Key User Flows

1. **Host Live Game Flow**:
   - Host opens the **Live Game Board**.
   - Selects a clue tile (e.g., Slang Dictionary · $800).
   - An interactive modal slides in with an 8-second countdown bar, clue text, and live buzzer unlock.
   - A player buzzes in on their phone (or host triggers keyboard buzz `1`-`4`).
   - Buzzer locks, showing the first responder with timestamp.
   - Host reveals answer, clicks **Correct (+$800)** or **Wrong (-$800)**; podium scores automatically update with audio cheers or womp buzzer. Tile becomes "Claimed".

2. **Presentation Ingestion & Deck Building Flow**:
   - Host clicks **Deck Builder** in header.
   - Uploads a `.pptx` presentation or pastes notes/Q&A into the parser.
   - Clicks **AI Auto-Categorize & Seed** (calls `/api/gemini/parse-deck`).
   - Gemini organizes extracted bullet points into 6 distinct categories with $200–$1000 point values.
   - Overflow clues appear in the **Extracted Clue Staging Buffer** with quick "+ Slot In" buttons or drag-and-drop to swap slots.
   - Host hits **Launch Board** to immediately play the customized deck.

3. **Mobile Phone Buzzer Flow**:
   - Players click "Join Mobile Buzzer" or scan the QR code modal.
   - Select team name (or create their own custom avatar & name).
   - When a clue is active on the host board, the buzzer glows neon green.
   - Players tap the giant tactile buzzer. The fastest buzz is awarded 1st in the queue with haptic visual feedback; subsequent buzzers show their queue rank (#2, #3).

---

## 3. Technical Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                              APP ROOT                                  │
│   (Global Game State, Audio Synthesizer Engine, Shared Storage)        │
└───────┬───────────────────────────────┬────────────────────────────┬───┘
        │                               │                            │
        ▼                               ▼                            ▼
┌──────────────────┐          ┌──────────────────┐         ┌──────────────────┐
│   BOARD ARENA    │          │   DECK BUILDER   │         │  PHONE BUZZER    │
│                  │          │                  │         │                  │
│ • Header & HUD   │          │ • PPTX Parser    │         │ • Mobile Layout  │
│ • 6-Column Grid  │          │ • Raw Q&A Parser │         │ • Team Selector  │
│ • Clue Modal     │          │ • AI Seed Engine │         │ • Giant Buzzer   │
│ • Podium Scores  │          │ • 30-Slot Grid   │         │ • Queue Feedback │
│ • Soundboard FX  │          │ • Staging Buffer │         │ • Clue Peek      │
└──────────────────┘          └──────────────────┘         └──────────────────┘
        │                               │
        ▼                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SERVER PROXY API (Express)                      │
│ • POST /api/gemini/parse-deck: Slide & text categorization via Gemini  │
│ • Server-authoritative Gemini client initialized with aistudio headers │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Models & State Architecture

```typescript
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
  name: string;
  subtitle: string;
  icon: string;
  clues: Clue[];
}

export interface Team {
  id: string;
  name: string;
  score: number;
  streak: number;
  color: string;
  emoji: string;
}

export interface BuzzerEvent {
  teamId: string;
  teamName: string;
  timestamp: number; // millisecond precision
}
```

---

## 4. Plan Execution Steps

1. **Backend Server Setup (`server.ts` & Gemini integration)**:
   - Configure Express proxy on port 3000.
   - Implement `POST /api/gemini/parse-deck` using `@google/genai` with model `gemini-3.8-flash` and strict JSON response schema.
   - Integrate slide parsing (handling text, Markdown, bullet points, and extracted PPTX text).
2. **Audio FX Synthesizer Engine**:
   - Zero-dependency browser Web Audio API audio synthesis for Think Music, Buzzer, Air Horn, Stadium Cheer, and Daily Double fanfares.
3. **Interactive 6-Column Jeopardy Board**:
   - Exact replication of the visual layout from Image 1 / HTML with responsive breakpoints.
   - Interactive Clue Modal with 8s timer, solution flip, buzz lockout, and point award/deduct handlers.
   - Podium scoreboard with leader crown, score adjustments (+/- $200), and quick buzz controls.
4. **Deck Builder & Ingestion Studio**:
   - Replicate layout from Image 3 / HTML with drag-and-drop presentation upload, raw text editor, sample loaders, and automated slot distributors.
   - Direct integration with Gemini to turn unstructured slide notes into 6 game categories.
   - Unassigned clue staging buffer with "+ Slot In" buttons and instant board rebalancing.
5. **Mobile Phone Buzzer Application**:
   - Responsive, touch-optimized phone view with room code join, team picker, big haptic buzzer button, and synced queue feedback.
   - Integrated QR code and share link modal for instant mobile player onboarding.
6. **Verification & Build Validation**:
   - Run `compile_applet` and test gameplay loops, ingestion flows, and buzzer interactions.
