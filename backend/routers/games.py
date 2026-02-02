"""
Games Router - Handles game logic endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import random

router = APIRouter()


class GuessResult(BaseModel):
    correct: bool
    answer: str
    player_id: int
    points_earned: int


class JourneyChallenge(BaseModel):
    teams: List[str]
    hint: Optional[str] = None


class ComparisonPair(BaseModel):
    player_a: Dict
    player_b: Dict


# Mock journey data
JOURNEYS = [
    {"teams": ["UTA", "CLE", "LAL"], "answer": "Jordan Clarkson", "player_id": 203903},
    {"teams": ["OKC", "HOU", "BKN", "PHI"], "answer": "James Harden", "player_id": 201935},
    {"teams": ["CLE", "MIA", "CLE", "LAL"], "answer": "LeBron James", "player_id": 2544},
    {"teams": ["TOR", "LAL", "MIA"], "answer": "Kyle Lowry", "player_id": 200768},
    {"teams": ["GSW", "OKC", "GSW", "BKN", "PHX"], "answer": "Kevin Durant", "player_id": 201142},
    {"teams": ["CHI", "MIN", "PHI", "MIA", "CHI"], "answer": "Jimmy Butler", "player_id": 202710},
]

# Mock comparison data
COMPARISONS = [
    {
        "player_a": {"id": 201142, "name": "Kevin Durant", "season": "2013-14", "pts": 32.0, "reb": 7.4, "ast": 5.5, "fg": 50.3},
        "player_b": {"id": 201935, "name": "James Harden", "season": "2018-19", "pts": 36.1, "reb": 6.6, "ast": 7.5, "fg": 44.2},
    },
    {
        "player_a": {"id": 203507, "name": "Giannis Antetokounmpo", "season": "2019-20", "pts": 29.5, "reb": 13.6, "ast": 5.6, "fg": 55.3},
        "player_b": {"id": 203954, "name": "Joel Embiid", "season": "2022-23", "pts": 33.1, "reb": 10.2, "ast": 4.2, "fg": 54.8},
    },
]


@router.get("/daily-challenge")
async def get_daily_challenge():
    """Get today's daily challenge"""
    import hashlib
    from datetime import date
    
    today = date.today().isoformat()
    hash_val = int(hashlib.md5(today.encode()).hexdigest(), 16)
    
    # Mock player for daily challenge
    players = [
        {"id": 203507, "name": "Giannis Antetokounmpo", "team": "MIL", "hint": "Greek Freak, 2x MVP"},
        {"id": 203999, "name": "Nikola Jokic", "team": "DEN", "hint": "Serbian big man, 3x MVP"},
        {"id": 201566, "name": "Luka Doncic", "team": "DAL", "hint": "Slovenian guard, Triple-double machine"},
    ]
    
    player_index = hash_val % len(players)
    return {"challenge": players[player_index], "date": today}


@router.post("/check-guess")
async def check_guess(player_id: int, guess: str):
    """Check if a guess is correct"""
    # Mock player database lookup
    players = {
        203507: "Giannis Antetokounmpo",
        203999: "Nikola Jokic",
        201566: "Luka Doncic",
        2544: "LeBron James",
    }
    
    correct_name = players.get(player_id, "Unknown")
    guess_lower = guess.lower().strip()
    name_lower = correct_name.lower()
    
    # Check if guess matches (partial match for last name)
    is_correct = (
        guess_lower == name_lower or
        guess_lower in name_lower or
        name_lower.split()[-1].lower() in guess_lower
    )
    
    return GuessResult(
        correct=is_correct,
        answer=correct_name,
        player_id=player_id,
        points_earned=100 if is_correct else 0
    )


@router.get("/journey/random")
async def get_random_journey():
    """Get a random journey challenge"""
    journey = random.choice(JOURNEYS)
    return {
        "teams": journey["teams"],
        "hint": f"Played for {len(journey['teams'])} teams"
    }


@router.post("/journey/check")
async def check_journey(teams: List[str], guess: str):
    """Check if a journey guess is correct"""
    for journey in JOURNEYS:
        if journey["teams"] == teams:
            is_correct = guess.lower() in journey["answer"].lower()
            return {
                "correct": is_correct,
                "answer": journey["answer"],
                "player_id": journey["player_id"],
                "points_earned": 100 if is_correct else 0
            }
    
    raise HTTPException(status_code=404, detail="Journey not found")


@router.get("/comparison/random")
async def get_random_comparison():
    """Get a random stat comparison"""
    comparison = random.choice(COMPARISONS)
    
    # Return stats without names for blind comparison
    return {
        "player_a": {
            "pts": comparison["player_a"]["pts"],
            "reb": comparison["player_a"]["reb"],
            "ast": comparison["player_a"]["ast"],
            "fg": comparison["player_a"]["fg"],
            "season": comparison["player_a"]["season"],
        },
        "player_b": {
            "pts": comparison["player_b"]["pts"],
            "reb": comparison["player_b"]["reb"],
            "ast": comparison["player_b"]["ast"],
            "fg": comparison["player_b"]["fg"],
            "season": comparison["player_b"]["season"],
        },
        "comparison_id": COMPARISONS.index(comparison)
    }


@router.post("/comparison/reveal")
async def reveal_comparison(comparison_id: int, choice: str):
    """Reveal the comparison result"""
    if comparison_id >= len(COMPARISONS):
        raise HTTPException(status_code=404, detail="Comparison not found")
    
    comparison = COMPARISONS[comparison_id]
    
    # Calculate "winner" based on overall stats
    a_score = comparison["player_a"]["pts"] + comparison["player_a"]["reb"] + comparison["player_a"]["ast"]
    b_score = comparison["player_b"]["pts"] + comparison["player_b"]["reb"] + comparison["player_b"]["ast"]
    
    winner = "A" if a_score > b_score else "B"
    user_correct = choice.upper() == winner
    
    return {
        "correct": user_correct,
        "winner": winner,
        "player_a": comparison["player_a"],
        "player_b": comparison["player_b"],
        "points_earned": 100 if user_correct else 0
    }


@router.post("/battle/calculate")
async def calculate_battle(user_team: Dict, opponent_team: Dict):
    """Calculate battle result between two teams"""
    def calculate_team_score(team: Dict) -> float:
        total = 0
        for player in team.values():
            if isinstance(player, dict):
                total += player.get("rating", 0)
                total += player.get("pts", 0)
                total += player.get("reb", 0)
                total += player.get("ast", 0)
        return total
    
    user_score = calculate_team_score(user_team)
    opponent_score = calculate_team_score(opponent_team)
    
    return {
        "user_score": round(user_score, 1),
        "opponent_score": round(opponent_score, 1),
        "winner": "user" if user_score > opponent_score else "opponent",
        "margin": abs(round(user_score - opponent_score, 1))
    }
