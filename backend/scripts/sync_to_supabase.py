"""
Sync NBA Data to Supabase
Fetches all player data using LeagueDashPlayerStats (fast - 1 API call)
and syncs to Supabase cached_players table.

Run this script:
  python scripts/sync_to_supabase.py

Or via scheduled GitHub Action to keep data fresh.
"""

import os
import sys
import json
import time
from datetime import datetime
from typing import List, Dict
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from nba_api.stats.endpoints import LeagueDashPlayerStats
from supabase import create_client, Client

# Load environment variables
load_dotenv(Path(__file__).parent.parent / ".env")

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

CURRENT_SEASON = "2025-26"

# Team ID to abbreviation map
TEAM_ABBR_MAP = {
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


def infer_position(row) -> str:
    """Infer position from stats"""
    pts = row.get("PTS", 0) or 0
    reb = row.get("REB", 0) or 0
    ast = row.get("AST", 0) or 0
    blk = row.get("BLK", 0) or 0
    
    if reb > 8 and blk > 1:
        return "C"
    elif reb > 6 and pts > 15:
        return "PF"
    elif ast > 5:
        return "PG"
    elif pts > 15 and reb < 5:
        return "SG"
    else:
        return "SF"


def fetch_all_players() -> List[Dict]:
    """
    Fetch ALL active NBA players using LeagueDashPlayerStats
    Single API call - very efficient (~0.5s for 500+ players)
    """
    print(f"🏀 Fetching all players for {CURRENT_SEASON} season...")
    
    # Add delay to avoid rate limiting
    time.sleep(0.6)
    
    # Fetch all player stats for current season
    league_stats = LeagueDashPlayerStats(
        season=CURRENT_SEASON,
        per_mode_detailed="PerGame",
        season_type_all_star="Regular Season"
    )
    
    df = league_stats.get_data_frames()[0]
    print(f"📊 Retrieved {len(df)} players from NBA API")
    
    players = []
    for _, row in df.iterrows():
        # Calculate rating
        pts = row.get("PTS", 0) or 0
        reb = row.get("REB", 0) or 0
        ast = row.get("AST", 0) or 0
        stl = row.get("STL", 0) or 0
        blk = row.get("BLK", 0) or 0
        fg_pct = row.get("FG_PCT", 0) or 0
        
        rating = min(99, max(60, int(
            50 + pts * 1.5 + reb * 0.8 + ast * 1.2 + stl * 2 + blk * 2 + fg_pct * 20
        )))
        
        player = {
            "player_id": int(row["PLAYER_ID"]),
            "full_name": row["PLAYER_NAME"],
            "team_id": int(row.get("TEAM_ID", 0)),
            "team_abbreviation": TEAM_ABBR_MAP.get(row.get("TEAM_ID"), row.get("TEAM_ABBREVIATION", "FA")),
            "is_active": True,
            "position": infer_position(row),
            "season_stats": {
                "season": CURRENT_SEASON,
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
            },
            "updated_at": datetime.now().isoformat(),
        }
        players.append(player)
    
    # Sort by PPG
    players.sort(key=lambda x: x["season_stats"]["pts"], reverse=True)
    
    return players


def sync_to_supabase(players: List[Dict]):
    """Sync player data to Supabase cached_players table"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("⚠️  Supabase credentials not found in .env")
        print("   Required: SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_KEY)")
        # Save to local JSON for testing
        with open("players_backup.json", "w") as f:
            json.dump(players, f, indent=2)
        print(f"📁 Saved {len(players)} players to players_backup.json")
        return False
    
    print(f"📤 Syncing {len(players)} players to Supabase...")
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        
        # Batch upsert in chunks of 100
        batch_size = 100
        success_count = 0
        
        for i in range(0, len(players), batch_size):
            batch = players[i:i + batch_size]
            
            # Upsert batch
            result = supabase.table("cached_players").upsert(batch).execute()
            success_count += len(batch)
            
            print(f"  ✅ Synced {success_count}/{len(players)} players...")
        
        print(f"\n🎉 Successfully synced {success_count} players to Supabase!")
        return True
        
    except Exception as e:
        print(f"❌ Error syncing to Supabase: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main sync function"""
    print("=" * 50)
    print("🏀 GARU - NBA Data Sync to Supabase")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🗓️  Season: {CURRENT_SEASON}")
    print("=" * 50)
    
    # Step 1: Fetch all players from NBA API
    players = fetch_all_players()
    
    if not players:
        print("❌ No players fetched. Aborting.")
        return
    
    print(f"\n📊 Stats Summary:")
    print(f"   Total players: {len(players)}")
    print(f"   Top scorer: {players[0]['full_name']} ({players[0]['season_stats']['pts']} PPG)")
    
    # Show position distribution
    positions = {}
    for p in players:
        pos = p["position"]
        positions[pos] = positions.get(pos, 0) + 1
    print(f"   Position distribution: {positions}")
    
    # Step 2: Sync to Supabase
    print()
    sync_to_supabase(players)
    
    print("\n" + "=" * 50)
    print("✅ Sync complete!")
    print("=" * 50)


if __name__ == "__main__":
    main()
