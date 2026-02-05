"""
NBA Service - Live data fetching from NBA API
Uses LeagueDashPlayerStats for all player stats in one call
"""

import json
import os
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from pathlib import Path

# Cache configuration
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
    Get all players - from cache or fresh from API
    With fallback to expired cache if API fails
    """
    if not force_refresh:
        cached = get_cached_players()
        if cached:
            print(f"📦 Using cached data ({len(cached)} players)")
            return cached
    
    # Try to fetch fresh data
    try:
        fresh_data = fetch_all_players_live()
        if fresh_data:
            return fresh_data
    except Exception as e:
        print(f"⚠️ API fetch failed: {e}")
    
    # Fallback to expired cache
    expired_cache = get_expired_cache()
    if expired_cache:
        print(f"📦 Using expired cache as fallback ({len(expired_cache)} players)")
        return expired_cache
    
    # Last resort: return empty list
    print("❌ No data available - cache and API both failed")
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
