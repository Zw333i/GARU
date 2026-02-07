"""
NBA Service - Live data fetching from NBA API
Uses LeagueDashPlayerStats for all player stats in one call
Supports Supabase caching for production
"""

import json
import os
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from pathlib import Path

# Supabase client (lazy initialization)
_supabase_client = None

def get_supabase_client():
    """Get or create Supabase client (lazy initialization)"""
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
        if url and key:
            try:
                from supabase import create_client
                _supabase_client = create_client(url, key)
                print("✅ Supabase client initialized")
            except Exception as e:
                print(f"⚠️ Failed to initialize Supabase: {e}")
                _supabase_client = None
    return _supabase_client


def get_players_from_supabase() -> Optional[List[Dict]]:
    """
    Fetch all players from Supabase cached_players table.
    Returns None if Supabase is not available or fetch fails.
    """
    client = get_supabase_client()
    if not client:
        return None
    
    try:
        # Fetch all players from cached_players table
        result = client.table("cached_players").select("*").execute()
        
        if result.data:
            players = []
            for row in result.data:
                # Convert Supabase row to our player format
                stats = row.get("season_stats", {})
                player = {
                    "id": row["player_id"],
                    "name": row["full_name"],
                    "team": row["team_abbreviation"],
                    "position": row.get("position", "SF"),
                    "rating": stats.get("rating", 75),
                    "pts": stats.get("pts", 0),
                    "reb": stats.get("reb", 0),
                    "ast": stats.get("ast", 0),
                    "stl": stats.get("stl", 0),
                    "blk": stats.get("blk", 0),
                    "fg_pct": stats.get("fg_pct", 0),
                    "fg3_pct": stats.get("fg3_pct", 0),
                    "ft_pct": stats.get("ft_pct", 0),
                    "gp": stats.get("gp", 0),
                    "mpg": stats.get("mpg", 0),
                    "season": stats.get("season", CURRENT_SEASON),
                }
                players.append(player)
            
            # Sort by PPG
            players.sort(key=lambda x: x["pts"], reverse=True)
            print(f"📦 Loaded {len(players)} players from Supabase")
            return players
        
        return None
    except Exception as e:
        print(f"⚠️ Supabase fetch error: {e}")
        return None


def get_journey_players_from_supabase() -> Optional[List[Dict]]:
    """
    Fetch journey players from Supabase journey_players table.
    Returns None if not available.
    """
    client = get_supabase_client()
    if not client:
        return None
    
    try:
        result = client.table("journey_players").select("*").execute()
        
        if result.data and len(result.data) > 0:
            players = []
            for row in result.data:
                players.append({
                    "id": row["player_id"],
                    "name": row["player_name"],
                    "teams": row.get("teams", []),
                    "current_team": row.get("current_team", "FA"),
                })
            print(f"📦 Loaded {len(players)} journey players from Supabase")
            return players
        return None
    except Exception as e:
        print(f"⚠️ Supabase journey fetch error: {e}")
        return None


def save_journey_players_to_supabase(players: List[Dict]) -> bool:
    """
    Save journey players to Supabase journey_players table.
    """
    client = get_supabase_client()
    if not client or not players:
        return False
    
    try:
        # Prepare data for upsert
        rows = []
        for p in players:
            rows.append({
                "player_id": p["id"],
                "player_name": p["name"],
                "teams": p.get("teams", []),
                "current_team": p.get("current_team", "FA"),
                "updated_at": datetime.now().isoformat(),
            })
        
        # Upsert to Supabase
        result = client.table("journey_players").upsert(rows, on_conflict="player_id").execute()
        print(f"✅ Saved {len(rows)} journey players to Supabase")
        return True
    except Exception as e:
        print(f"⚠️ Supabase journey save error: {e}")
        return False


# Cache configuration (fallback for local development)
CACHE_DIR = Path(__file__).parent.parent / "cache"
CACHE_FILE = CACHE_DIR / "nba_players_2025_26.json"
CACHE_DURATION_HOURS = 24  # Refresh data every 24 hours

# Current season
CURRENT_SEASON = "2025-26"

def get_cached_players() -> Optional[List[Dict]]:
    """Get players from cache if valid"""
    try:
        if not CACHE_FILE.exists():
            return None
        
        with open(CACHE_FILE, "r") as f:
            data = json.load(f)
        
        # Check if cache is still valid
        cached_time = datetime.fromisoformat(data.get("timestamp", "2000-01-01"))
        if datetime.now() - cached_time > timedelta(hours=CACHE_DURATION_HOURS):
            return None
        
        return data.get("players", [])
    except Exception as e:
        print(f"Cache read error: {e}")
        return None


def save_to_cache(players: List[Dict]) -> None:
    """Save players to cache"""
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
        data = {
            "timestamp": datetime.now().isoformat(),
            "season": CURRENT_SEASON,
            "count": len(players),
            "players": players
        }
        
        with open(CACHE_FILE, "w") as f:
            json.dump(data, f, indent=2)
        
        print(f"✅ Cached {len(players)} players")
    except Exception as e:
        print(f"Cache write error: {e}")


def fetch_all_players_live() -> List[Dict]:
    """
    Fetch ALL active NBA players for 2025-26 season using LeagueDashPlayerStats
    This is the most efficient way - 1 API call for ~450 players
    Now also fetches real positions from PlayerIndex
    """
    try:
        from nba_api.stats.endpoints import LeagueDashPlayerStats, PlayerIndex
        from nba_api.stats.static import players as static_players
        import time
        
        print(f"🏀 Fetching all players for {CURRENT_SEASON} season...")
        
        # First fetch real positions from PlayerIndex
        position_map = fetch_player_positions()
        
        # Add delay to avoid rate limiting
        time.sleep(0.6)
        
        # Fetch all player stats for current season
        # PerMode: PerGame gives us per-game averages
        league_stats = LeagueDashPlayerStats(
            season=CURRENT_SEASON,
            per_mode_detailed="PerGame",
            season_type_all_star="Regular Season"
        )
        
        # Get the data
        df = league_stats.get_data_frames()[0]
        
        print(f"📊 Retrieved {len(df)} players from NBA API")
        
        # Map team IDs to abbreviations
        team_abbr_map = {
            1610612737: "ATL", 1610612738: "BOS", 1610612739: "CLE",
            1610612740: "NOP", 1610612741: "CHI", 1610612742: "DAL",
            1610612743: "DEN", 1610612744: "GSW", 1610612745: "HOU",
            1610612746: "LAC", 1610612747: "LAL", 1610612748: "MIA",
            1610612749: "MIL", 1610612750: "MIN", 1610612751: "BKN",
            1610612752: "NYK", 1610612753: "ORL", 1610612754: "IND",
            1610612755: "PHI", 1610612756: "PHX", 1610612757: "POR",
            1610612758: "SAC", 1610612759: "SAS", 1610612760: "OKC",
            1610612761: "TOR", 1610612762: "UTA", 1610612763: "MEM",
            1610612764: "WAS", 1610612765: "DET", 1610612766: "CHA",
        }
        
        players = []
        for _, row in df.iterrows():
            # Calculate a simple rating based on stats (0-99 scale)
            pts = row.get("PTS", 0) or 0
            reb = row.get("REB", 0) or 0
            ast = row.get("AST", 0) or 0
            stl = row.get("STL", 0) or 0
            blk = row.get("BLK", 0) or 0
            fg_pct = row.get("FG_PCT", 0) or 0
            
            # Simple rating formula
            rating = min(99, max(60, int(
                50 + pts * 1.5 + reb * 0.8 + ast * 1.2 + stl * 2 + blk * 2 + fg_pct * 20
            )))
            
            # Get player stats for position inference
            stats = {"pts": pts, "reb": reb, "ast": ast, "stl": stl, "blk": blk}
            
            # Get real position from PlayerIndex, normalize it
            player_id = int(row["PLAYER_ID"])
            raw_position = position_map.get(player_id, "")
            position = normalize_position(raw_position, stats)
            
            player = {
                "id": player_id,
                "name": row["PLAYER_NAME"],
                "team": team_abbr_map.get(row.get("TEAM_ID"), row.get("TEAM_ABBREVIATION", "FA")),
                "position": position,
                "age": int(row.get("AGE", 0)) if row.get("AGE") else None,
                "gp": int(row.get("GP", 0)),
                "mpg": round(float(row.get("MIN", 0) or 0), 1),
                "pts": round(float(pts), 1),
                "reb": round(float(reb), 1),
                "ast": round(float(ast), 1),
                "stl": round(float(stl), 1),
                "blk": round(float(blk), 1),
                "fg_pct": round(float(fg_pct) * 100, 1) if fg_pct < 1 else round(float(fg_pct), 1),
                "fg3_pct": round(float(row.get("FG3_PCT", 0) or 0) * 100, 1),
                "ft_pct": round(float(row.get("FT_PCT", 0) or 0) * 100, 1),
                "rating": rating,
                "season": CURRENT_SEASON,
            }
            players.append(player)
        
        # Sort by points per game (descending)
        players.sort(key=lambda x: x["pts"], reverse=True)
        
        # Cache the results
        save_to_cache(players)
        
        return players
        
    except ImportError:
        print("❌ nba_api not installed. Run: pip install nba_api")
        return []
    except Exception as e:
        print(f"❌ Error fetching NBA data: {e}")
        import traceback
        traceback.print_exc()
        return []


def fetch_player_positions() -> Dict[int, str]:
    """
    Fetch real position data from PlayerIndex endpoint.
    Returns a dict mapping player_id -> position
    """
    try:
        from nba_api.stats.endpoints import PlayerIndex
        import time
        
        print("📋 Fetching player positions from PlayerIndex...")
        time.sleep(0.6)  # Rate limiting
        
        player_index = PlayerIndex(season=CURRENT_SEASON)
        df = player_index.get_data_frames()[0]
        
        positions = {}
        for _, row in df.iterrows():
            player_id = int(row["PERSON_ID"])
            position = row.get("POSITION", "")
            positions[player_id] = position
        
        print(f"✅ Got positions for {len(positions)} players")
        return positions
    except Exception as e:
        print(f"⚠️ Error fetching positions: {e}")
        return {}


def normalize_position(pos: str, stats: dict = None) -> str:
    """
    Convert NBA API position format to standard 5-position format.
    NBA API uses: G, F, C, G-F, F-G, C-F, F-C, etc.
    We want: PG, SG, SF, PF, C
    """
    if not pos:
        return infer_position_from_stats(stats) if stats else "SF"
    
    pos = pos.upper().strip()
    
    # Direct mappings for single positions
    if pos == "C":
        return "C"
    
    # For guards, use stats to differentiate PG vs SG
    if pos == "G":
        if stats:
            ast = stats.get("ast", 0) or 0
            pts = stats.get("pts", 0) or 0
            if ast > 4 or (ast > 2 and pts < 15):
                return "PG"
        return "SG"
    
    # For forwards, use stats to differentiate SF vs PF
    if pos == "F":
        if stats:
            reb = stats.get("reb", 0) or 0
            blk = stats.get("blk", 0) or 0
            if reb > 6 or blk > 1:
                return "PF"
        return "SF"
    
    # Combo positions - use first position as primary
    if "-" in pos:
        primary, secondary = pos.split("-")
        
        if primary == "C":
            return "C"
        if primary == "F" and secondary == "C":
            return "PF"
        if ("F" in pos and "G" in pos):
            if stats:
                ast = stats.get("ast", 0) or 0
                reb = stats.get("reb", 0) or 0
                if ast > reb:
                    return "SG"
            return "SF"
        if primary == "G":
            return "SG"
        if primary == "F":
            return "SF"
    
    return infer_position_from_stats(stats) if stats else "SF"


def infer_position_from_stats(stats: dict) -> str:
    """Fallback position inference from stats"""
    if not stats:
        return "SF"
    
    pts = stats.get("pts", 0) or 0
    reb = stats.get("reb", 0) or 0
    ast = stats.get("ast", 0) or 0
    blk = stats.get("blk", 0) or 0
    
    if reb > 8 and blk > 1:
        return "C"
    if reb > 10:
        return "C"
    if reb > 6:
        return "PF"
    if ast > 5:
        return "PG"
    if ast > 3 and pts < 18:
        return "PG"
    if pts > 15 and reb < 5 and ast < 5:
        return "SG"
    
    return "SF"


def get_expired_cache() -> Optional[List[Dict]]:
    """Get cached players even if expired (fallback)"""
    try:
        if not CACHE_FILE.exists():
            return None
        
        with open(CACHE_FILE, "r") as f:
            data = json.load(f)
        
        return data.get("players", [])
    except Exception as e:
        print(f"Fallback cache read error: {e}")
        return None


def get_all_players(force_refresh: bool = False) -> List[Dict]:
    """
    Get all players with priority:
    1. Supabase (production - synced daily)
    2. Local cache (development fallback)
    3. Live NBA API (last resort)
    4. Expired cache (absolute fallback)
    """
    if not force_refresh:
        # Priority 1: Try Supabase first (production data source)
        supabase_players = get_players_from_supabase()
        if supabase_players:
            return supabase_players
        
        # Priority 2: Fall back to local cache (development)
        cached = get_cached_players()
        if cached:
            print(f"📦 Using local cached data ({len(cached)} players)")
            return cached
    
    # Priority 3: Fetch fresh data from NBA API
    try:
        fresh_data = fetch_all_players_live()
        if fresh_data:
            return fresh_data
    except Exception as e:
        print(f"⚠️ API fetch failed: {e}")
    
    # Priority 4: Fallback to expired cache
    expired_cache = get_expired_cache()
    if expired_cache:
        print(f"📦 Using expired cache as fallback ({len(expired_cache)} players)")
        return expired_cache
    
    # Last resort: return empty list
    print("❌ No data available - all sources failed")
    return []


def get_players_by_team(team: str) -> List[Dict]:
    """Get all players from a specific team"""
    all_players = get_all_players()
    return [p for p in all_players if p["team"] == team.upper()]


def get_players_by_position(position: str) -> List[Dict]:
    """Get all players at a specific position"""
    all_players = get_all_players()
    return [p for p in all_players if p["position"] == position.upper()]


def get_top_players(count: int = 50) -> List[Dict]:
    """Get top N players by rating"""
    all_players = get_all_players()
    sorted_players = sorted(all_players, key=lambda x: x["rating"], reverse=True)
    return sorted_players[:count]


def get_role_players(count: int = 30) -> List[Dict]:
    """Get role players (mid-tier by PPG) for guessing games"""
    all_players = get_all_players()
    # Role players: 8-18 PPG range with at least 15 games played
    role_players = [
        p for p in all_players 
        if 8 <= p["pts"] <= 18 and p["gp"] >= 15
    ]
    # Sort by games played (more recognizable players)
    role_players.sort(key=lambda x: x["gp"], reverse=True)
    return role_players[:count]


def get_stars(min_ppg: float = 20.0) -> List[Dict]:
    """Get star players (20+ PPG)"""
    all_players = get_all_players()
    return [p for p in all_players if p["pts"] >= min_ppg and p["gp"] >= 10]


def search_players(query: str) -> List[Dict]:
    """Search players by name"""
    all_players = get_all_players()
    query_lower = query.lower()
    return [p for p in all_players if query_lower in p["name"].lower()]


# Team configurations for draft mode
NBA_TEAMS = [
    {"abbr": "ATL", "name": "Atlanta Hawks", "conference": "East"},
    {"abbr": "BOS", "name": "Boston Celtics", "conference": "East"},
    {"abbr": "BKN", "name": "Brooklyn Nets", "conference": "East"},
    {"abbr": "CHA", "name": "Charlotte Hornets", "conference": "East"},
    {"abbr": "CHI", "name": "Chicago Bulls", "conference": "East"},
    {"abbr": "CLE", "name": "Cleveland Cavaliers", "conference": "East"},
    {"abbr": "DAL", "name": "Dallas Mavericks", "conference": "West"},
    {"abbr": "DEN", "name": "Denver Nuggets", "conference": "West"},
    {"abbr": "DET", "name": "Detroit Pistons", "conference": "East"},
    {"abbr": "GSW", "name": "Golden State Warriors", "conference": "West"},
    {"abbr": "HOU", "name": "Houston Rockets", "conference": "West"},
    {"abbr": "IND", "name": "Indiana Pacers", "conference": "East"},
    {"abbr": "LAC", "name": "LA Clippers", "conference": "West"},
    {"abbr": "LAL", "name": "Los Angeles Lakers", "conference": "West"},
    {"abbr": "MEM", "name": "Memphis Grizzlies", "conference": "West"},
    {"abbr": "MIA", "name": "Miami Heat", "conference": "East"},
    {"abbr": "MIL", "name": "Milwaukee Bucks", "conference": "East"},
    {"abbr": "MIN", "name": "Minnesota Timberwolves", "conference": "West"},
    {"abbr": "NOP", "name": "New Orleans Pelicans", "conference": "West"},
    {"abbr": "NYK", "name": "New York Knicks", "conference": "East"},
    {"abbr": "OKC", "name": "Oklahoma City Thunder", "conference": "West"},
    {"abbr": "ORL", "name": "Orlando Magic", "conference": "East"},
    {"abbr": "PHI", "name": "Philadelphia 76ers", "conference": "East"},
    {"abbr": "PHX", "name": "Phoenix Suns", "conference": "West"},
    {"abbr": "POR", "name": "Portland Trail Blazers", "conference": "West"},
    {"abbr": "SAC", "name": "Sacramento Kings", "conference": "West"},
    {"abbr": "SAS", "name": "San Antonio Spurs", "conference": "West"},
    {"abbr": "TOR", "name": "Toronto Raptors", "conference": "East"},
    {"abbr": "UTA", "name": "Utah Jazz", "conference": "West"},
    {"abbr": "WAS", "name": "Washington Wizards", "conference": "East"},
]


# Team ID to abbreviation mapping (includes historical teams)
TEAM_ID_TO_ABBR = {
    1610612737: "ATL", 1610612738: "BOS", 1610612739: "CLE",
    1610612740: "NOP", 1610612741: "CHI", 1610612742: "DAL",
    1610612743: "DEN", 1610612744: "GSW", 1610612745: "HOU",
    1610612746: "LAC", 1610612747: "LAL", 1610612748: "MIA",
    1610612749: "MIL", 1610612750: "MIN", 1610612751: "BKN",
    1610612752: "NYK", 1610612753: "ORL", 1610612754: "IND",
    1610612755: "PHI", 1610612756: "PHX", 1610612757: "POR",
    1610612758: "SAC", 1610612759: "SAS", 1610612760: "OKC",
    1610612761: "TOR", 1610612762: "UTA", 1610612763: "MEM",
    1610612764: "WAS", 1610612765: "DET", 1610612766: "CHA",
    # Historical teams
    1610612760: "OKC",  # Also was SEA (Seattle SuperSonics)
    1610612763: "MEM",  # Was VAN (Vancouver Grizzlies)
    1610612751: "BKN",  # Was NJN (New Jersey Nets)
    1610612740: "NOP",  # Was NOH/NOK (New Orleans Hornets/Oklahoma City)
    1610612766: "CHA",  # Was CHH/CHA (Charlotte Bobcats)
}


def get_player_team_history(player_id: int) -> List[str]:
    """
    Get the team history for a specific player from NBA API.
    Returns list of team abbreviations in chronological order.
    """
    try:
        from nba_api.stats.endpoints import playercareerstats
        import time
        
        time.sleep(0.6)  # Rate limiting
        
        career = playercareerstats.PlayerCareerStats(player_id=player_id)
        df = career.get_data_frames()[0]  # Regular season stats
        
        if len(df) == 0:
            return []
        
        # Get unique teams in chronological order (by season)
        teams = []
        for _, row in df.iterrows():
            team_id = row.get("TEAM_ID")
            team_abbr = TEAM_ID_TO_ABBR.get(team_id)
            
            # Also try TEAM_ABBREVIATION column
            if not team_abbr:
                team_abbr = row.get("TEAM_ABBREVIATION", "")
            
            # Skip "TOT" - this is combined stats when traded mid-season, not a real team
            if team_abbr == "TOT":
                continue
            
            # Handle historical team names
            if team_abbr == "NJN":
                team_abbr = "BKN"
            elif team_abbr == "SEA":
                team_abbr = "OKC"
            elif team_abbr == "VAN":
                team_abbr = "MEM"
            elif team_abbr in ["NOH", "NOK"]:
                team_abbr = "NOP"
            elif team_abbr == "CHH":
                team_abbr = "CHA"
                
            if team_abbr and (not teams or teams[-1] != team_abbr):
                teams.append(team_abbr)
        
        return teams
        
    except Exception as e:
        print(f"Error getting team history for player {player_id}: {e}")
        return []


def get_journey_players(count: int = 30, min_teams: int = 3) -> List[Dict]:
    """
    Get players with their team history for The Journey game.
    Only returns players who have played for at least min_teams teams.
    Priority: Supabase -> File Cache -> NBA API
    """
    import random
    import time
    
    # 1. Try Supabase first (fastest)
    supabase_players = get_journey_players_from_supabase()
    if supabase_players and len(supabase_players) >= 10:
        filtered = [p for p in supabase_players if len(p.get("teams", [])) >= min_teams]
        if len(filtered) >= 10:
            random.shuffle(filtered)
            return filtered[:count]
    
    # 2. Try file cache second
    journey_cache_file = CACHE_DIR / "journey_players.json"
    
    try:
        if journey_cache_file.exists():
            with open(journey_cache_file, "r") as f:
                data = json.load(f)
            cached_time = datetime.fromisoformat(data.get("timestamp", "2000-01-01"))
            if datetime.now() - cached_time < timedelta(hours=CACHE_DURATION_HOURS * 7):  # Cache for a week
                print(f"📦 Using cached journey data ({len(data.get('players', []))} players)")
                players = data.get("players", [])
                # Filter by min_teams and limit
                filtered = [p for p in players if len(p.get("teams", [])) >= min_teams]
                random.shuffle(filtered)
                return filtered[:count]
    except Exception as e:
        print(f"Journey cache read error: {e}")
    
    # 3. Fall back to NBA API (slowest - only when no cache available)
    print(f"🏀 Fetching journey players from NBA API...")
    
    # Get list of notable players to check (veterans with long careers)
    all_players = get_all_players()
    
    journey_players = []
    
    # Sort by games played to prioritize veterans
    sorted_players = sorted(all_players, key=lambda x: x.get("gp", 0), reverse=True)
    
    for player in sorted_players[:100]:  # Check top 100 by games played
        player_id = player["id"]
        player_name = player["name"]
        
        print(f"  Checking {player_name}...")
        
        team_history = get_player_team_history(player_id)
        
        if len(team_history) >= min_teams:
            journey_players.append({
                "id": player_id,
                "name": player_name,
                "teams": team_history,
                "current_team": player.get("team", team_history[-1] if team_history else "FA"),
            })
            print(f"    ✅ {player_name}: {' -> '.join(team_history)}")
        
        if len(journey_players) >= count * 2:  # Get double what we need
            break
        
        time.sleep(0.3)  # Additional rate limiting
    
    # Save to both file cache and Supabase
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_data = {
            "timestamp": datetime.now().isoformat(),
            "players": journey_players
        }
        with open(journey_cache_file, "w") as f:
            json.dump(cache_data, f, indent=2)
        print(f"✅ Cached {len(journey_players)} journey players to file")
    except Exception as e:
        print(f"Journey cache write error: {e}")
    
    # Save to Supabase for future fast fetches
    save_journey_players_to_supabase(journey_players)
    
    random.shuffle(journey_players)
    return journey_players[:count]
