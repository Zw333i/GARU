"""
NBA Data Fetcher Script
Fetches player data from nba_api and populates Supabase database.
Run this script weekly via GitHub Actions to keep data fresh.
"""

import os
import json
import time
from datetime import datetime
from typing import List, Dict, Optional
from dotenv import load_dotenv

# NBA API imports
from nba_api.stats.static import players, teams
from nba_api.stats.endpoints import (
    commonplayerinfo,
    playercareerstats,
    leagueleaders,
    playerestimatedmetrics,
)

# Supabase import
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None
    print("⚠️  Supabase credentials not found. Running in dry-run mode.")


def get_active_players() -> List[Dict]:
    """Get all active NBA players"""
    print("📥 Fetching active players...")
    active_players = players.get_active_players()
    print(f"✅ Found {len(active_players)} active players")
    return active_players


def get_player_stats(player_id: int, season: str = "2025-26") -> Optional[Dict]:
    """Get career stats for a specific player"""
    try:
        time.sleep(0.6)  # Rate limiting
        career = playercareerstats.PlayerCareerStats(player_id=player_id)
        df = career.get_data_frames()[0]
        
        # Get most recent season
        if len(df) > 0:
            # Filter for current season if available
            current_season = df[df['SEASON_ID'] == season]
            if len(current_season) > 0:
                stats = current_season.iloc[0].to_dict()
            else:
                # Fall back to most recent season
                stats = df.iloc[-1].to_dict()
            
            return {
                "season": stats.get("SEASON_ID", season),
                "team_id": stats.get("TEAM_ID"),
                "gp": stats.get("GP", 0),
                "min": stats.get("MIN", 0),
                "pts": round(stats.get("PTS", 0) / max(stats.get("GP", 1), 1), 1),
                "reb": round(stats.get("REB", 0) / max(stats.get("GP", 1), 1), 1),
                "ast": round(stats.get("AST", 0) / max(stats.get("GP", 1), 1), 1),
                "stl": round(stats.get("STL", 0) / max(stats.get("GP", 1), 1), 1),
                "blk": round(stats.get("BLK", 0) / max(stats.get("GP", 1), 1), 1),
                "fg_pct": round(stats.get("FG_PCT", 0) * 100, 1),
                "fg3_pct": round(stats.get("FG3_PCT", 0) * 100, 1),
                "ft_pct": round(stats.get("FT_PCT", 0) * 100, 1),
            }
    except Exception as e:
        print(f"  ⚠️  Error fetching stats for player {player_id}: {e}")
    
    return None


def get_player_position(player_id: int) -> str:
    """Get player position"""
    try:
        time.sleep(0.6)
        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
        df = info.get_data_frames()[0]
        if len(df) > 0:
            position = df.iloc[0].get("POSITION", "")
            # Normalize position
            pos_map = {
                "Guard": "G",
                "Forward": "F", 
                "Center": "C",
                "Guard-Forward": "G-F",
                "Forward-Guard": "G-F",
                "Forward-Center": "F-C",
                "Center-Forward": "F-C",
            }
            return pos_map.get(position, position[:2] if position else "N/A")
    except Exception as e:
        print(f"  ⚠️  Error fetching position for player {player_id}: {e}")
    return "N/A"


def get_team_abbr(team_id: int) -> str:
    """Get team abbreviation from team ID"""
    all_teams = teams.get_teams()
    for team in all_teams:
        if team["id"] == team_id:
            return team["abbreviation"]
    return "N/A"


def get_role_players(all_players: List[Dict], min_games: int = 20, max_ppg: float = 15.0) -> List[Dict]:
    """Filter for role players (not stars, but regular contributors)"""
    role_players = []
    
    for player in all_players:
        stats = player.get("season_stats", {})
        if stats:
            gp = stats.get("gp", 0)
            ppg = stats.get("pts", 0)
            min_per_game = stats.get("min", 0) / max(gp, 1) if gp > 0 else 0
            
            # Role player criteria
            if gp >= min_games and 5.0 <= ppg <= max_ppg and min_per_game >= 15:
                role_players.append(player)
    
    return role_players


def save_to_supabase(players_data: List[Dict]):
    """Save player data to Supabase"""
    if not supabase:
        print("⚠️  Skipping Supabase upload (dry-run mode)")
        # Save to local JSON for testing
        with open("players_data.json", "w") as f:
            json.dump(players_data, f, indent=2)
        print("📁 Saved data to players_data.json")
        return
    
    print("📤 Uploading to Supabase...")
    
    for player in players_data:
        try:
            # Upsert player data
            data = {
                "player_id": player["id"],
                "full_name": player["full_name"],
                "team_abbreviation": player.get("team_abbreviation", "N/A"),
                "is_active": True,
                "position": player.get("position", "N/A"),
                "season_stats": player.get("season_stats", {}),
                "updated_at": datetime.now().isoformat(),
            }
            
            supabase.table("cached_players").upsert(data).execute()
            print(f"  ✅ {player['full_name']}")
            
        except Exception as e:
            print(f"  ❌ Error uploading {player['full_name']}: {e}")
    
    print("✅ Upload complete!")


def main():
    """Main function to fetch and save NBA data"""
    print("=" * 50)
    print("🏀 GARU - NBA Data Fetcher")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    
    # Get all active players
    active_players = get_active_players()
    
    # Limit to top players for initial testing (remove in production)
    # In production, process all players but with proper rate limiting
    players_to_process = active_players[:50]  # Adjust as needed
    
    enriched_players = []
    
    for i, player in enumerate(players_to_process):
        player_id = player["id"]
        player_name = player["full_name"]
        
        print(f"\n[{i+1}/{len(players_to_process)}] Processing {player_name}...")
        
        # Get stats
        stats = get_player_stats(player_id)
        if not stats:
            print(f"  ⏭️  Skipping (no stats found)")
            continue
        
        # Get position
        position = get_player_position(player_id)
        
        # Get team abbreviation
        team_abbr = get_team_abbr(stats.get("team_id", 0))
        
        enriched_player = {
            "id": player_id,
            "full_name": player_name,
            "team_abbreviation": team_abbr,
            "position": position,
            "season_stats": stats,
        }
        
        enriched_players.append(enriched_player)
        print(f"  ✅ {player_name} - {team_abbr} - {stats['pts']} PPG")
    
    print(f"\n📊 Processed {len(enriched_players)} players")
    
    # Filter role players
    role_players = get_role_players(enriched_players)
    print(f"🎯 Found {len(role_players)} role players")
    
    # Save to Supabase
    save_to_supabase(enriched_players)
    
    print("\n✅ Data fetch complete!")


if __name__ == "__main__":
    main()
