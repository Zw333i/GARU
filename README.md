# 🏀 GARU - The NBA Knowledge Arena

A professional, portfolio-grade NBA web application that bridges the gap between casual fans (guessing games) and data nerds (shot charts/advanced insights).

> **The Vibe:** Clean, data-driven, futuristic but accessible. Think "Spotify for Basketball Stats" meets "Daily Wordle."

![GARU Banner](https://via.placeholder.com/1200x400/0F172A/84CC16?text=GARU+-+NBA+Knowledge+Arena)

## 🚀 Features

### 🎮 Game Modes
- **Who's That Role Player?** - Guess players from blurred images and stat hints
- **The Journey** - Identify players from their career team paths
- **Blind Comparison** - Compare anonymous stat lines and pick your draft choice
- **Draft Battle (5v5)** - Build your dream team and battle against AI or other players

### 📊 The Lab (Education Module)
- **Shot Chart Visualizer** - Interactive hex-bin shot maps with hot zones
- **Stat Translator** - Tap on complex stats (TS%, PER, BPM) to learn what they mean
- **Player Comparisons** - Side-by-side stat analysis with radar charts

### 👤 Profile & Progress
- Daily challenges with streak tracking
- Achievement system
- XP and leveling
- Battle history and win/loss records

## 🛠️ Tech Stack

### Frontend
- **Next.js 14+** (App Router) - Fast, SEO-friendly React framework
- **Tailwind CSS** - Utility-first styling with custom "Heatmap" theme
- **Zustand** - Lightweight state management
- **Framer Motion** - Smooth animations
- **Recharts** - Line/bar charts
- **D3.js** - Custom shot chart visualizations

### Backend
- **FastAPI** (Python) - Fast API framework with auto-documentation
- **nba_api** - Python wrapper for NBA.com data
- **Supabase** - PostgreSQL database + Auth + Realtime

### Infrastructure
- **Vercel** - Frontend hosting (seamless Next.js integration)
- **Render** - Backend hosting (free tier)
- **GitHub Actions** - Weekly data refresh cron jobs

## 🎨 Design System

### Color Palette - "The Heatmap" Theme
| Color | Hex | Usage |
|-------|-----|-------|
| Deep Void | `#0F172A` | Background |
| Gunmetal | `#1E293B` | Cards/Surfaces |
| Electric Lime | `#84CC16` | Primary accent, "Good" stats |
| Hot Pink | `#EC4899` | Secondary accent, "Bad" stats |
| Ghost White | `#F8FAFC` | Text |

## 📁 Project Structure

```
GARU/
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── app/             # App router pages
│   │   ├── components/      # React components
│   │   ├── lib/             # Utilities & Supabase client
│   │   └── store/           # Zustand stores
│   ├── public/              # Static assets
│   └── package.json
│
├── backend/                  # FastAPI server
│   ├── main.py              # Entry point
│   ├── routers/             # API routes
│   │   ├── players.py       # Player endpoints
│   │   ├── games.py         # Game logic endpoints
│   │   └── stats.py         # Statistics endpoints
│   ├── scripts/             # Data fetching scripts
│   └── requirements.txt
│
└── .github/
    └── workflows/           # GitHub Actions
        └── update-nba-data.yml
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase account (free tier)

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
python main.py
```

### Supabase Setup

1. Create a new Supabase project
2. Run the SQL schema (see Database Schema section below)
3. Enable Google OAuth in Authentication settings
4. Copy your project URL and anon key to `.env` files

## 💾 Database Schema

```sql
-- Enable RLS
alter table public.cached_players enable row level security;
alter table public.users enable row level security;
alter table public.battles enable row level security;

-- Players cache table
create table public.cached_players (
  player_id integer primary key,
  full_name text not null,
  team_abbreviation text,
  is_active boolean default true,
  position text,
  season_stats jsonb,
  updated_at timestamp with time zone default now()
);

-- Users table (extends Supabase auth)
create table public.users (
  id uuid references auth.users primary key,
  username text unique,
  avatar_url text,
  wins integer default 0,
  losses integer default 0,
  created_at timestamp with time zone default now()
);

-- Battles table
create table public.battles (
  battle_id uuid primary key default gen_random_uuid(),
  user_id_1 uuid references public.users(id),
  user_id_2 uuid,
  winner_id uuid,
  user_team jsonb,
  opponent_team jsonb,
  user_score numeric,
  opponent_score numeric,
  created_at timestamp with time zone default now()
);

-- Draft teams table
create table public.draft_teams (
  team_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  pg_id integer,
  sg_id integer,
  sf_id integer,
  pf_id integer,
  c_id integer,
  team_score numeric,
  created_at timestamp with time zone default now()
);
```

## 🔄 Data Refresh

Player data is automatically refreshed weekly via GitHub Actions. You can also manually trigger the workflow or run the script locally:

```bash
cd backend
python scripts/fetch_nba_data.py
```

## 📱 Mobile-First Design

- Bottom navigation bar for easy thumb access
- Swipe gestures for player comparisons
- All interactive elements in the bottom 50% of the screen
- Responsive grid layouts

## 🔒 Authentication

- **Guest Mode**: Play games and view stats without logging in
- **Authenticated Mode**: Required for saving teams, battles, and leaderboard
- **Provider**: Google OAuth via Supabase (one-tap login)

## 📦 Deployment

### Frontend (Vercel)
```bash
cd frontend
vercel --prod
```

### Backend (Render)
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically on push

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [nba_api](https://github.com/swar/nba_api) for NBA data access
- [BallDontLie API](https://www.balldontlie.io/) for live data
- NBA for player images and statistics

---

Built with 🏀 by the GARU Team
