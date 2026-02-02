"""
Stats Router - Handles statistics and analytics endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List, Dict
import random
import math
import io

# Try to import visualization libraries
try:
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
    import numpy as np
    from scipy import stats as scipy_stats
    HAS_VISUALIZATION = True
except ImportError:
    HAS_VISUALIZATION = False

router = APIRouter()


class StatDefinition(BaseModel):
    abbr: str
    name: str
    description: str
    formula: Optional[str] = None
    example: Optional[str] = None
    category: str


# Stat glossary
STAT_GLOSSARY = [
    {
        "abbr": "PER",
        "name": "Player Efficiency Rating",
        "description": "A measure of per-minute production standardized so that the league average is 15.",
        "example": "A PER of 25+ is MVP-level. Nikola Jokic led with 31.3 in 2021-22.",
        "category": "Advanced"
    },
    {
        "abbr": "TS%",
        "name": "True Shooting Percentage",
        "description": "Measures shooting efficiency by weighing 2-point, 3-point field goals, and free throws.",
        "formula": "TS% = PTS / (2 × (FGA + 0.44 × FTA))",
        "example": "Elite shooters have TS% above 60%.",
        "category": "Shooting"
    },
    {
        "abbr": "USG%",
        "name": "Usage Rate",
        "description": "Estimate of percentage of team plays used by a player while on floor.",
        "example": "Ball-dominant players like Luka often have USG% above 30%.",
        "category": "Advanced"
    },
    {
        "abbr": "BPM",
        "name": "Box Plus/Minus",
        "description": "Box score estimate of points per 100 possessions above league average.",
        "example": "+5 is excellent, +10 is MVP-level.",
        "category": "Advanced"
    },
    {
        "abbr": "eFG%",
        "name": "Effective Field Goal Percentage",
        "description": "Adjusts FG% to account for the extra value of 3-point shots.",
        "formula": "eFG% = (FGM + 0.5 × 3PM) / FGA",
        "category": "Shooting"
    },
    {
        "abbr": "ORTG",
        "name": "Offensive Rating",
        "description": "Points produced per 100 possessions.",
        "example": "League average is ~110. Elite offenses are 115+.",
        "category": "Team"
    },
    {
        "abbr": "DRTG",
        "name": "Defensive Rating",
        "description": "Points allowed per 100 possessions. Lower is better.",
        "example": "League average is ~110. Elite defenses are 105 or below.",
        "category": "Team"
    },
]


@router.get("/glossary")
async def get_stat_glossary(category: Optional[str] = None):
    """Get stat definitions"""
    stats = STAT_GLOSSARY
    
    if category:
        stats = [s for s in stats if s["category"].lower() == category.lower()]
    
    return {"stats": stats, "count": len(stats)}


@router.get("/glossary/{abbr}")
async def get_stat_definition(abbr: str):
    """Get a specific stat definition"""
    stat = next((s for s in STAT_GLOSSARY if s["abbr"].lower() == abbr.lower()), None)
    if not stat:
        raise HTTPException(status_code=404, detail="Stat not found")
    return stat


@router.get("/shot-chart/{player_id}")
async def get_shot_chart(player_id: int):
    """Get shot chart data for a player"""
    # Generate mock shot chart data
    # In production, this would come from nba_api
    shots = []
    
    for _ in range(random.randint(100, 200)):
        x = random.uniform(-235, 235)
        y = random.uniform(50, 400)
        distance = math.sqrt(x**2 + y**2)
        
        # Simulate realistic shooting percentages
        if distance < 50:  # Rim
            made = random.random() < 0.65
        elif distance < 150:  # Mid-range
            made = random.random() < 0.40
        else:  # Three-pointer
            made = random.random() < 0.35
        
        shots.append({
            "x": round(x, 1),
            "y": round(y, 1),
            "made": made,
            "distance": round(distance / 10, 1),  # Convert to feet
            "is_three": distance > 220
        })
    
    # Calculate zone stats
    total = len(shots)
    made = len([s for s in shots if s["made"]])
    threes = [s for s in shots if s["is_three"]]
    threes_made = len([s for s in threes if s["made"]])
    
    return {
        "player_id": player_id,
        "shots": shots,
        "stats": {
            "total_shots": total,
            "made": made,
            "fg_pct": round((made / total) * 100, 1) if total > 0 else 0,
            "three_attempts": len(threes),
            "three_made": threes_made,
            "three_pct": round((threes_made / len(threes)) * 100, 1) if threes else 0
        }
    }


@router.get("/heatmap/{player_id}")
async def get_player_heatmap(player_id: int):
    """Generate a KDE heatmap image for a player's shot distribution"""
    if not HAS_VISUALIZATION:
        raise HTTPException(
            status_code=500, 
            detail="Visualization libraries not installed. Run: pip install matplotlib numpy scipy"
        )
    
    # Generate shot data (in production, fetch from nba_api)
    np.random.seed(player_id)  # Consistent data per player
    n_shots = np.random.randint(200, 400)
    
    # Create realistic shot distribution
    shots_x = []
    shots_y = []
    
    for _ in range(n_shots):
        zone = np.random.choice(['paint', 'midrange', 'three', 'corner3'], p=[0.35, 0.15, 0.35, 0.15])
        
        if zone == 'paint':
            x = np.random.normal(0, 40)
            y = np.random.normal(60, 30)
        elif zone == 'midrange':
            angle = np.random.uniform(0, np.pi)
            r = np.random.uniform(80, 180)
            x = r * np.cos(angle) - r/2 + np.random.normal(0, 20)
            y = r * np.sin(angle) + np.random.normal(40, 20)
        elif zone == 'three':
            angle = np.random.uniform(0.2, np.pi - 0.2)
            r = np.random.uniform(220, 260)
            x = r * np.cos(angle) - r/2 + np.random.normal(0, 15)
            y = r * np.sin(angle) + np.random.normal(0, 15)
        else:  # corner3
            side = np.random.choice([-1, 1])
            x = side * np.random.uniform(200, 220)
            y = np.random.uniform(0, 60)
        
        # Clamp to court bounds
        x = np.clip(x, -250, 250)
        y = np.clip(y, -50, 400)
        shots_x.append(x)
        shots_y.append(y)
    
    shots_x = np.array(shots_x)
    shots_y = np.array(shots_y)
    
    # Create the heatmap
    fig, ax = plt.subplots(figsize=(10, 9), facecolor='#0F172A')
    ax.set_facecolor('#0F172A')
    
    # Draw court outline
    court_color = '#334155'
    
    # Three-point arc
    theta = np.linspace(0.38, np.pi - 0.38, 100)
    arc_x = 237.5 * np.cos(theta)
    arc_y = 237.5 * np.sin(theta) + 50
    ax.plot(arc_x, arc_y, color=court_color, linewidth=2)
    
    # Corner three lines
    ax.plot([-220, -220], [0, 90], color=court_color, linewidth=2)
    ax.plot([220, 220], [0, 90], color=court_color, linewidth=2)
    
    # Paint
    ax.plot([-80, -80], [0, 190], color=court_color, linewidth=2)
    ax.plot([80, 80], [0, 190], color=court_color, linewidth=2)
    ax.plot([-80, 80], [190, 190], color=court_color, linewidth=2)
    
    # Free throw circle
    ft_theta = np.linspace(0, np.pi, 50)
    ft_x = 60 * np.cos(ft_theta)
    ft_y = 60 * np.sin(ft_theta) + 190
    ax.plot(ft_x, ft_y, color=court_color, linewidth=2)
    
    # Rim
    rim = plt.Circle((0, 60), 15, fill=False, color='#EC4899', linewidth=3)
    ax.add_patch(rim)
    
    # Backboard
    ax.plot([-30, 30], [40, 40], color=court_color, linewidth=4)
    
    # Create KDE
    try:
        xy = np.vstack([shots_x, shots_y])
        kde = scipy_stats.gaussian_kde(xy, bw_method=0.15)
        
        # Create grid
        x_grid = np.linspace(-250, 250, 150)
        y_grid = np.linspace(-20, 400, 130)
        X, Y = np.meshgrid(x_grid, y_grid)
        Z = kde(np.vstack([X.ravel(), Y.ravel()])).reshape(X.shape)
        
        # Plot heatmap
        cmap = plt.cm.YlGn  # Yellow-Green colormap
        im = ax.contourf(X, Y, Z, levels=25, cmap=cmap, alpha=0.8)
        ax.contour(X, Y, Z, levels=10, colors='#84CC16', alpha=0.3, linewidths=0.5)
    except Exception:
        # Fallback to scatter if KDE fails
        ax.scatter(shots_x, shots_y, c='#84CC16', alpha=0.5, s=20)
    
    # Style
    ax.set_xlim(-260, 260)
    ax.set_ylim(-30, 420)
    ax.set_aspect('equal')
    ax.axis('off')
    
    # Title
    ax.set_title(f'Shot Distribution Heatmap', color='#F8FAFC', fontsize=16, pad=10)
    
    # Save to bytes
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', 
                facecolor='#0F172A', edgecolor='none', pad_inches=0.1)
    plt.close(fig)
    buf.seek(0)
    
    return Response(content=buf.getvalue(), media_type="image/png")


@router.get("/leaders")
async def get_stat_leaders(
    stat: str = Query("pts", description="Stat category (pts, reb, ast, stl, blk)"),
    limit: int = Query(10, le=50)
):
    """Get league leaders for a stat category"""
    # Mock leaders data
    leaders = {
        "pts": [
            {"player": "Joel Embiid", "team": "PHI", "value": 33.1},
            {"player": "Luka Doncic", "team": "DAL", "value": 32.4},
            {"player": "Shai Gilgeous-Alexander", "team": "OKC", "value": 31.1},
            {"player": "Giannis Antetokounmpo", "team": "MIL", "value": 30.4},
            {"player": "Kevin Durant", "team": "PHX", "value": 29.1},
        ],
        "reb": [
            {"player": "Domantas Sabonis", "team": "SAC", "value": 12.8},
            {"player": "Nikola Jokic", "team": "DEN", "value": 12.4},
            {"player": "Giannis Antetokounmpo", "team": "MIL", "value": 11.5},
            {"player": "Anthony Davis", "team": "LAL", "value": 11.0},
            {"player": "Joel Embiid", "team": "PHI", "value": 10.2},
        ],
        "ast": [
            {"player": "Tyrese Haliburton", "team": "IND", "value": 10.9},
            {"player": "Nikola Jokic", "team": "DEN", "value": 9.0},
            {"player": "LeBron James", "team": "LAL", "value": 8.3},
            {"player": "Luka Doncic", "team": "DAL", "value": 8.0},
            {"player": "Trae Young", "team": "ATL", "value": 7.4},
        ],
    }
    
    stat_data = leaders.get(stat.lower(), leaders["pts"])
    
    return {
        "stat": stat,
        "leaders": stat_data[:limit]
    }


@router.get("/team/{team_abbr}")
async def get_team_stats(team_abbr: str):
    """Get team statistics"""
    # Mock team data
    teams = {
        "BOS": {"name": "Boston Celtics", "wins": 48, "losses": 12, "ppg": 118.2, "opp_ppg": 108.5},
        "DEN": {"name": "Denver Nuggets", "wins": 44, "losses": 16, "ppg": 114.8, "opp_ppg": 110.2},
        "MIL": {"name": "Milwaukee Bucks", "wins": 42, "losses": 18, "ppg": 116.4, "opp_ppg": 112.1},
        "PHI": {"name": "Philadelphia 76ers", "wins": 40, "losses": 20, "ppg": 112.6, "opp_ppg": 109.8},
    }
    
    team = teams.get(team_abbr.upper())
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return team


@router.get("/compare")
async def compare_players(
    player_a_id: int = Query(..., description="First player ID"),
    player_b_id: int = Query(..., description="Second player ID")
):
    """Compare two players' stats"""
    # Mock comparison (in production, fetch from DB)
    mock_stats = {
        203999: {"name": "Nikola Jokic", "pts": 26.4, "reb": 12.4, "ast": 9.0, "per": 31.0},
        203507: {"name": "Giannis Antetokounmpo", "pts": 30.4, "reb": 11.5, "ast": 6.5, "per": 29.5},
        201566: {"name": "Luka Doncic", "pts": 32.4, "reb": 8.6, "ast": 8.0, "per": 27.3},
    }
    
    player_a = mock_stats.get(player_a_id, {"name": "Unknown", "pts": 0, "reb": 0, "ast": 0, "per": 0})
    player_b = mock_stats.get(player_b_id, {"name": "Unknown", "pts": 0, "reb": 0, "ast": 0, "per": 0})
    
    return {
        "player_a": {"id": player_a_id, **player_a},
        "player_b": {"id": player_b_id, **player_b},
        "comparison": {
            "pts": {"leader": "A" if player_a["pts"] > player_b["pts"] else "B"},
            "reb": {"leader": "A" if player_a["reb"] > player_b["reb"] else "B"},
            "ast": {"leader": "A" if player_a["ast"] > player_b["ast"] else "B"},
            "per": {"leader": "A" if player_a["per"] > player_b["per"] else "B"},
        }
    }
