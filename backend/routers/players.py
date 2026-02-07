"""
Players Router - Handles player data endpoints with LIVE NBA API data
Uses LeagueDashPlayerStats for all 450+ active players
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import random
import hashlib
from datetime import date

# Import our NBA service
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.nba_service import (
    get_all_players,
    get_players_by_team as service_get_by_team,
    get_players_by_position as service_get_by_position,
    get_top_players,
    get_role_players as service_get_role_players,
    get_stars,
    search_players as service_search,
    NBA_TEAMS,
    CURRENT_SEASON,
)

router = APIRouter()


class Player(BaseModel):
    id: int
    name: str
    team: str
    position: str
    rating: Optional[int] = None
    pts: float
    reb: float
    ast: Optional[float] = None
    fg_pct: Optional[float] = None
    stl: Optional[float] = None
    blk: Optional[float] = None
    gp: Optional[int] = None
    mpg: Optional[float] = None
    season: Optional[str] = None


class PlayerList(BaseModel):
    players: List[dict]
    count: int
    season: str


@router.get("/", response_model=PlayerList)
async def get_players(
    team: Optional[str] = Query(None, description="Filter by team abbreviation"),
    position: Optional[str] = Query(None, description="Filter by position"),
    min_ppg: Optional[float] = Query(None, description="Minimum points per game"),
    limit: int = Query(100, le=500, description="Maximum number of players to return"),
    refresh: bool = Query(False, description="Force refresh from NBA API"),
):
    """
    Get list of all NBA players for 2025-26 season with optional filters.
    First call fetches ~450 players from NBA API, subsequent calls use cache.
    """
    from services.nba_service import get_all_players as fetch_players
    
    players = fetch_players(force_refresh=refresh)
    
    if team:
        players = [p for p in players if p["team"] == team.upper()]
    if position:
        players = [p for p in players if p["position"] == position.upper()]
    if min_ppg:
        players = [p for p in players if p["pts"] >= min_ppg]
    
    players = players[:limit]
    
    return {
        "players": players,
        "count": len(players),
        "season": CURRENT_SEASON
    }


@router.get("/refresh")
async def refresh_players():
    """Force refresh player data from NBA API"""
    from services.nba_service import fetch_all_players_live
    
    players = fetch_all_players_live()
    return {
        "message": f"Refreshed {len(players)} players from NBA API",
        "count": len(players),
        "season": CURRENT_SEASON
    }


@router.get("/stars")
async def get_star_players(min_ppg: float = Query(20.0, description="Minimum PPG to be a star")):
    """Get star players (20+ PPG by default)"""
    stars = get_stars(min_ppg)
    return {
        "players": stars,
        "count": len(stars),
        "season": CURRENT_SEASON,
        "criteria": f"{min_ppg}+ PPG"
    }


@router.get("/top/{count}")
async def get_top_n_players(count: int = 50):
    """Get top N players by rating"""
    if count > 100:
        count = 100
    top = get_top_players(count)
    return {
        "players": top,
        "count": len(top),
        "season": CURRENT_SEASON
    }


@router.get("/random")
async def get_random_players(count: int = Query(1, le=10)):
    """Get random player(s) from all active players"""
    all_players = get_all_players()
    if not all_players:
        raise HTTPException(status_code=503, detail="No player data available")
    
    sample_size = min(count, len(all_players))
    players = random.sample(all_players, sample_size)
    return {"players": players, "season": CURRENT_SEASON}


@router.get("/role-players")
async def get_role_players(count: int = Query(30, le=50)):
    """Get role players (8-18 PPG) for guessing games"""
    role_players = service_get_role_players(count)
    return {
        "players": role_players,
        "count": len(role_players),
        "season": CURRENT_SEASON,
        "criteria": "8-18 PPG, 15+ games played"
    }


@router.get("/daily")
async def get_daily_player():
    """Get today's daily challenge player (deterministic based on date)"""
    all_players = get_all_players()
    if not all_players:
        raise HTTPException(status_code=503, detail="No player data available")
    
    # Use stars for daily challenge (more recognizable)
    stars = [p for p in all_players if p["pts"] >= 15 and p["gp"] >= 20]
    if not stars:
        stars = all_players[:50]
    
    today = date.today().isoformat()
    hash_val = int(hashlib.md5(today.encode()).hexdigest(), 16)
    player_index = hash_val % len(stars)
    
    return {
        "player": stars[player_index],
        "date": today,
        "season": CURRENT_SEASON
    }


@router.get("/teams")
async def get_all_teams():
    """Get all NBA teams"""
    return {"teams": NBA_TEAMS, "count": len(NBA_TEAMS)}


@router.get("/team/{team_abbr}")
async def get_team_roster(team_abbr: str):
    """Get all players from a specific team"""
    players = service_get_by_team(team_abbr)
    if not players:
        raise HTTPException(status_code=404, detail=f"No players found for team {team_abbr}")
    
    return {
        "team": team_abbr.upper(),
        "players": players,
        "count": len(players),
        "season": CURRENT_SEASON
    }


@router.get("/search/{query}")
async def search_players(query: str):
    """Search players by name"""
    matches = service_search(query)
    return {
        "query": query,
        "players": matches,
        "count": len(matches),
        "season": CURRENT_SEASON
    }


@router.get("/by-position/{position}")
async def get_players_by_position(
    position: str,
    limit: int = Query(5, le=20),
    for_draft: bool = Query(False, description="Randomize for draft mode")
):
    """Get players by position (for draft mode)"""
    valid_positions = ["PG", "SG", "SF", "PF", "C"]
    pos_upper = position.upper()
    
    if pos_upper not in valid_positions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid position. Must be one of: {valid_positions}"
        )
    
    players = service_get_by_position(pos_upper)
    
    # For draft mode, get random selection of varied skill levels
    if for_draft and len(players) > limit:
        # Mix of stars, good players, and role players
        sorted_players = sorted(players, key=lambda x: x["pts"], reverse=True)
        top_tier = sorted_players[:10]
        mid_tier = sorted_players[10:30] if len(sorted_players) > 30 else sorted_players[10:]
        
        selection = []
        if top_tier:
            selection.extend(random.sample(top_tier, min(2, len(top_tier))))
        if mid_tier:
            selection.extend(random.sample(mid_tier, min(limit - len(selection), len(mid_tier))))
        
        players = selection
    else:
        players = players[:limit]
    
    return {
        "players": players,
        "position": pos_upper,
        "count": len(players),
        "season": CURRENT_SEASON
    }


@router.get("/journey/players")
async def get_journey_game_players(
    count: int = Query(30, le=50, description="Number of journey players to return"),
    min_teams: int = Query(3, ge=2, le=5, description="Minimum teams played for"),
):
    """
    Get players with their complete team history for The Journey game.
    Returns players who have played for multiple teams.
    """
    from services.nba_service import get_journey_players
    
    players = get_journey_players(count, min_teams)
    
    return {
        "players": players,
        "count": len(players),
        "season": CURRENT_SEASON
    }


@router.get("/{player_id}")
async def get_player(player_id: int):
    """Get a specific player by ID"""
    all_players = get_all_players()
    player = next((p for p in all_players if p["id"] == player_id), None)
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    return {
        "player": player,
        "season": CURRENT_SEASON
    }
