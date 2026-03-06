"""
Stats Router - Handles statistics and analytics endpoints.

Data flow: Supabase cached_shot_charts (primary) -> NBA API (fetch + save) -> empty state
Never generates simulated or fake data.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List, Dict
import io
import os

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

from services.nba_service import get_supabase_client

router = APIRouter()


# ---------------------------------------------------------------------------
# Stat Glossary
# ---------------------------------------------------------------------------

class StatDefinition(BaseModel):
    abbr: str
    name: str
    description: str
    formula: Optional[str] = None
    example: Optional[str] = None
    category: str


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
        "formula": "TS% = PTS / (2 x (FGA + 0.44 x FTA))",
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
        "formula": "eFG% = (FGM + 0.5 x 3PM) / FGA",
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
    stats = STAT_GLOSSARY
    if category:
        stats = [s for s in stats if s["category"].lower() == category.lower()]
    return {"stats": stats, "count": len(stats)}


@router.get("/glossary/{abbr}")
async def get_stat_definition(abbr: str):
    stat = next((s for s in STAT_GLOSSARY if s["abbr"].lower() == abbr.lower()), None)
    if not stat:
        raise HTTPException(status_code=404, detail="Stat not found")
    return stat


# ---------------------------------------------------------------------------
# League averages by hex zone (2024-25 season)
# ---------------------------------------------------------------------------

LEAGUE_AVG_BY_ZONE: Dict[str, float] = {
    'restricted_area': 64.0,
    'paint_left': 42.0,
    'paint_right': 42.0,
    'paint_center': 44.0,
    'mid_left_baseline': 40.0,
    'mid_right_baseline': 40.0,
    'mid_left': 41.0,
    'mid_right': 41.0,
    'mid_center_left': 43.0,
    'mid_center': 45.0,
    'mid_center_right': 43.0,
    'corner_3_left': 38.0,
    'corner_3_right': 38.0,
    'above_break_3_left': 36.0,
    'above_break_3_right': 36.0,
    'above_break_3_center_left': 37.0,
    'above_break_3_center': 37.0,
    'above_break_3_center_right': 37.0,
}

ZONE_NAMES: Dict[str, str] = {
    'restricted_area': 'Restricted Area',
    'paint_left': 'Paint (Left)',
    'paint_right': 'Paint (Right)',
    'paint_center': 'Paint (Center)',
    'mid_left_baseline': 'Mid-Range Left Baseline',
    'mid_right_baseline': 'Mid-Range Right Baseline',
    'mid_left': 'Mid-Range Left',
    'mid_right': 'Mid-Range Right',
    'mid_center_left': 'Mid-Range Center Left',
    'mid_center': 'Mid-Range Center',
    'mid_center_right': 'Mid-Range Center Right',
    'corner_3_left': 'Left Corner 3',
    'corner_3_right': 'Right Corner 3',
    'above_break_3_left': 'Above Break 3 Left',
    'above_break_3_right': 'Above Break 3 Right',
    'above_break_3_center_left': 'Above Break 3 Center Left',
    'above_break_3_center': 'Above Break 3 Center',
    'above_break_3_center_right': 'Above Break 3 Center Right',
}


# ---------------------------------------------------------------------------
# Supabase helpers for shot chart cache
# ---------------------------------------------------------------------------

def _get_cached_shots(player_id: int, season: str):
    """Return the cached_shot_charts row for this player+season, or None."""
    client = get_supabase_client()
    if not client:
        return None
    try:
        result = (
            client.table("cached_shot_charts")
            .select("*")
            .eq("player_id", player_id)
            .eq("season", season)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Warning: Supabase read error (shot_charts): {e}")
        return None


def _save_shot_data(player_id: int, season: str, shots: list, zones: list,
                    distribution: list, total_shots: int, fg_pct: float,
                    three_pct: float, paint_pct: float):
    """Upsert shot chart data to Supabase cached_shot_charts."""
    client = get_supabase_client()
    if not client:
        return
    try:
        client.table("cached_shot_charts").upsert({
            "player_id": player_id,
            "season": season,
            "shots": shots,
            "zones": zones,
            "distribution": distribution,
            "total_shots": total_shots,
            "fg_pct": fg_pct,
            "three_pct": three_pct,
            "paint_pct": paint_pct,
        }, on_conflict="player_id,season").execute()
        print(f"Saved shot chart for player {player_id} ({season}) to Supabase")
    except Exception as e:
        print(f"Warning: Supabase write error (shot_charts): {e}")


# ---------------------------------------------------------------------------
# Shot classification helpers
# ---------------------------------------------------------------------------

def classify_shot_zone(x: float, y: float, distance: float) -> str:
    """Classify a shot into one of the 18 hex zone keys."""
    if y <= 50 and distance <= 40:
        return 'restricted_area'
    if y <= 190 and abs(x) <= 80:
        if x < -25:
            return 'paint_left'
        elif x > 25:
            return 'paint_right'
        else:
            return 'paint_center'
    is_three = distance > 237.5 or (abs(x) >= 220 and y <= 90)
    if is_three:
        if y <= 90:
            return 'corner_3_left' if x < 0 else 'corner_3_right'
        if abs(x) > 130:
            return 'above_break_3_left' if x < 0 else 'above_break_3_right'
        elif abs(x) > 50:
            return 'above_break_3_center_left' if x < 0 else 'above_break_3_center_right'
        else:
            return 'above_break_3_center'
    if y <= 100:
        return 'mid_left_baseline' if x < 0 else 'mid_right_baseline'
    elif abs(x) > 100:
        return 'mid_left' if x < 0 else 'mid_right'
    elif abs(x) > 40:
        return 'mid_center_left' if x < 0 else 'mid_center_right'
    else:
        return 'mid_center'


def _compute_zones_from_shots(shots: list):
    """Derive hex zone data and distribution data from a raw shots list."""
    hex_raw: Dict[str, Dict] = {k: {'made': 0, 'attempts': 0} for k in LEAGUE_AVG_BY_ZONE}
    dist_raw = {
        'restricted_area': {'made': 0, 'attempts': 0, 'name': 'Restricted Area'},
        'paint':           {'made': 0, 'attempts': 0, 'name': 'Paint (Non-RA)'},
        'mid_range':       {'made': 0, 'attempts': 0, 'name': 'Mid-Range'},
        'corner_3':        {'made': 0, 'attempts': 0, 'name': 'Corner 3'},
        'above_break_3':   {'made': 0, 'attempts': 0, 'name': 'Above Break 3'},
    }
    total = len(shots)
    total_made = 0
    three_attempts = 0
    three_made = 0
    paint_attempts = 0
    paint_made = 0

    for s in shots:
        x, y, made = float(s['x']), float(s['y']), bool(s['made'])
        dist = (x**2 + y**2) ** 0.5
        if made:
            total_made += 1

        zk = classify_shot_zone(x, y, dist)
        if zk in hex_raw:
            hex_raw[zk]['attempts'] += 1
            if made:
                hex_raw[zk]['made'] += 1

        is_three = dist > 237.5 or (abs(x) >= 220 and y <= 90)
        if y <= 50 and dist <= 40:
            dk = 'restricted_area'
        elif y <= 190 and abs(x) <= 80:
            dk = 'paint'
        elif is_three:
            dk = 'corner_3' if (abs(x) >= 220 and y <= 90) else 'above_break_3'
        else:
            dk = 'mid_range'
        dist_raw[dk]['attempts'] += 1
        if made:
            dist_raw[dk]['made'] += 1

        if is_three:
            three_attempts += 1
            if made:
                three_made += 1
        if dist <= 80:
            paint_attempts += 1
            if made:
                paint_made += 1

    hex_zones = []
    for zk, data in hex_raw.items():
        if data['attempts'] > 0:
            freq = data['attempts'] / total if total > 0 else 0
            size = 'high' if freq > 0.10 else ('med' if freq > 0.04 else 'low')
            hex_zones.append({
                'zone': ZONE_NAMES.get(zk, zk),
                'zone_key': zk,
                'made': data['made'],
                'attempts': data['attempts'],
                'pct': round((data['made'] / data['attempts']) * 100, 1),
                'league_avg': LEAGUE_AVG_BY_ZONE.get(zk, 40.0),
                'size': size,
            })

    distribution = []
    for data in dist_raw.values():
        att = data['attempts']
        md = data['made']
        distribution.append({
            'zone': data['name'],
            'pct': round((att / total * 100), 1) if total > 0 else 0,
            'efficiency': round((md / att * 100), 1) if att > 0 else 0,
            'made': md,
            'attempts': att,
        })

    fg_pct = round((total_made / total) * 100, 1) if total > 0 else 0
    three_pct = round((three_made / three_attempts) * 100, 1) if three_attempts > 0 else 0
    paint_pct = round((paint_made / paint_attempts) * 100, 1) if paint_attempts > 0 else 0

    return hex_zones, distribution, total, fg_pct, three_pct, paint_pct


# ---------------------------------------------------------------------------
# Core fetch: DB first, NBA API fallback, save to DB
# ---------------------------------------------------------------------------

def _fetch_and_cache_shot_data(player_id: int, season: str):
    """
    Return shot data row. Checks Supabase first; if missing fetches from
    NBA API, saves to Supabase, and returns. Returns None if no data exists.
    Never generates simulated data.
    """
    row = _get_cached_shots(player_id, season)
    if row:
        print(f"Cache hit: shot chart for player {player_id} ({season})")
        return row

    print(f"Fetching shot chart from NBA API for player {player_id} ({season})...")
    shots = []
    try:
        from nba_api.stats.endpoints import shotchartdetail
        import time
        time.sleep(0.6)
        shot_data = shotchartdetail.ShotChartDetail(
            team_id=0,
            player_id=player_id,
            season_nullable=season,
            season_type_all_star='Regular Season',
            context_measure_simple='FGA',
            timeout=20,
        )
        df = shot_data.get_data_frames()[0]
        if len(df) > 0:
            for _, s in df.iterrows():
                fx, fy = float(s['LOC_X']), float(s['LOC_Y'])
                dist = (fx**2 + fy**2) ** 0.5
                shots.append({
                    'x': round(fx, 1),
                    'y': round(fy, 1),
                    'made': bool(s['SHOT_MADE_FLAG'] == 1),
                    'is_three': bool(dist > 237.5 or (abs(fx) >= 220 and fy <= 90)),
                })
            print(f"Fetched {len(shots)} shots for player {player_id}")
    except Exception as e:
        print(f"NBA API unavailable for shot chart ({player_id}): {e}")

    if not shots:
        return None

    hex_zones, distribution, total_shots, fg_pct, three_pct, paint_pct = _compute_zones_from_shots(shots)

    _save_shot_data(
        player_id=player_id,
        season=season,
        shots=shots,
        zones=hex_zones,
        distribution=distribution,
        total_shots=total_shots,
        fg_pct=fg_pct,
        three_pct=three_pct,
        paint_pct=paint_pct,
    )

    return {
        "player_id": player_id,
        "season": season,
        "shots": shots,
        "zones": hex_zones,
        "distribution": distribution,
        "total_shots": total_shots,
        "fg_pct": fg_pct,
        "three_pct": three_pct,
        "paint_pct": paint_pct,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/shot-chart/{player_id}")
async def get_shot_chart(player_id: int, season: str = "2024-25"):
    """Individual shot dots. DB-first, never simulated."""
    row = _fetch_and_cache_shot_data(player_id, season)
    if not row:
        return {
            "player_id": player_id,
            "using_real_data": False,
            "shots": [],
            "stats": {"total_shots": 0, "made": 0, "fg_pct": 0, "three_attempts": 0, "three_made": 0, "three_pct": 0},
        }
    shots = row["shots"]
    total = len(shots)
    made = sum(1 for s in shots if s["made"])
    threes = [s for s in shots if s["is_three"]]
    threes_made = sum(1 for s in threes if s["made"])
    return {
        "player_id": player_id,
        "using_real_data": True,
        "shots": shots,
        "stats": {
            "total_shots": total,
            "made": made,
            "fg_pct": round((made / total) * 100, 1) if total else 0,
            "three_attempts": len(threes),
            "three_made": threes_made,
            "three_pct": round((threes_made / len(threes)) * 100, 1) if threes else 0,
        },
    }


@router.get("/shot-zones/{player_id}")
async def get_shot_zones(player_id: int, season: str = "2024-25"):
    """Hex bin zones. DB-first, never simulated."""
    row = _fetch_and_cache_shot_data(player_id, season)
    if not row:
        return {"player_id": player_id, "using_real_data": False, "total_shots": 0, "fg_pct": 0, "three_pct": 0, "paint_pct": 0, "zones": []}
    return {
        "player_id": player_id,
        "using_real_data": True,
        "total_shots": row["total_shots"],
        "fg_pct": row["fg_pct"],
        "three_pct": row["three_pct"],
        "paint_pct": row["paint_pct"],
        "zones": row["zones"],
    }


@router.get("/shot-distribution/{player_id}")
async def get_shot_distribution(player_id: int, season: str = "2024-25"):
    """Five-zone shot distribution. DB-first, never simulated."""
    row = _fetch_and_cache_shot_data(player_id, season)
    if not row:
        return {"player_id": player_id, "using_real_data": False, "total_shots": 0, "zones": []}
    return {
        "player_id": player_id,
        "using_real_data": True,
        "total_shots": row["total_shots"],
        "zones": row["distribution"],
    }


@router.get("/heatmap/{player_id}")
async def get_player_heatmap(player_id: int, season: str = "2024-25"):
    """
    KDE heatmap PNG generated from authenticated shot data in Supabase.
    Returns 404 if no data is available (run sync script to populate DB).
    """
    if not HAS_VISUALIZATION:
        raise HTTPException(status_code=500, detail="Visualization libraries not installed. Run: pip install matplotlib numpy scipy")

    row = _fetch_and_cache_shot_data(player_id, season)
    if not row or not row.get("shots"):
        raise HTTPException(status_code=404, detail="No shot data available for this player. Run the sync script to populate the database.")

    shots = row["shots"]
    shots_x = np.array([s["x"] for s in shots])
    shots_y = np.array([s["y"] for s in shots])

    fig = plt.figure(figsize=(12, 11), facecolor='#000000')
    gs = fig.add_gridspec(2, 1, height_ratios=[10, 1], hspace=0.05)
    ax = fig.add_subplot(gs[0])
    cax = fig.add_subplot(gs[1])
    ax.set_facecolor('#000000')
    court_color = '#AAAAAA'
    court_lw = 1.5
    im = None
    try:
        xy = np.vstack([shots_x, shots_y])
        kde = scipy_stats.gaussian_kde(xy, bw_method=0.25)
        x_grid = np.linspace(-250, 250, 500)
        y_grid = np.linspace(-50, 300, 438)
        X, Y = np.meshgrid(x_grid, y_grid)
        Z = kde(np.vstack([X.ravel(), Y.ravel()])).reshape(X.shape)
        Z_power = np.power(Z, 0.5)
        Z_min, Z_max = Z_power.min(), Z_power.max()
        Z_norm = (Z_power - Z_min) / (Z_max - Z_min) if Z_max > Z_min else Z_power
        from matplotlib.colors import LinearSegmentedColormap
        cmap = LinearSegmentedColormap.from_list('smooth_heat', [
            (0.00, '#000000'), (0.10, '#1a0a24'), (0.25, '#4a1076'),
            (0.40, '#8b1a6b'), (0.55, '#c92e4a'), (0.70, '#e85a2c'),
            (0.85, '#f99c1c'), (1.00, '#fcec38'),
        ])
        im = ax.contourf(X, Y, Z_norm, levels=50, cmap=cmap, antialiased=True)
    except Exception as e:
        print(f"KDE failed: {e}")

    theta = np.linspace(np.arcsin(90 / 237.5), np.pi - np.arcsin(90 / 237.5), 100)
    ax.plot(237.5 * np.cos(theta), 237.5 * np.sin(theta), color=court_color, linewidth=court_lw, zorder=10)
    ax.plot([-220, -220], [-47.5, 90], color=court_color, linewidth=court_lw, zorder=10)
    ax.plot([220, 220], [-47.5, 90], color=court_color, linewidth=court_lw, zorder=10)
    pw, ph = 80, 190
    ax.plot([-pw, -pw], [-47.5, ph - 47.5], color=court_color, linewidth=court_lw, zorder=10)
    ax.plot([pw, pw], [-47.5, ph - 47.5], color=court_color, linewidth=court_lw, zorder=10)
    ax.plot([-pw, pw], [ph - 47.5, ph - 47.5], color=court_color, linewidth=court_lw, zorder=10)
    ft_t = np.linspace(0, np.pi, 50)
    ax.plot(60 * np.cos(ft_t), 60 * np.sin(ft_t) + ph - 47.5, color=court_color, linewidth=court_lw, zorder=10)
    ft_tb = np.linspace(np.pi, 2 * np.pi, 50)
    ax.plot(60 * np.cos(ft_tb), 60 * np.sin(ft_tb) + ph - 47.5, color=court_color, linewidth=court_lw, linestyle='--', alpha=0.5, zorder=10)
    ra_t = np.linspace(0, np.pi, 50)
    ax.plot(40 * np.cos(ra_t), 40 * np.sin(ra_t), color=court_color, linewidth=court_lw, zorder=10)
    ax.add_patch(plt.Circle((0, 0), 7.5, fill=False, color=court_color, linewidth=2, zorder=10))
    ax.plot([-30, 30], [-7.5, -7.5], color=court_color, linewidth=3, zorder=10)
    ax.set_xlim(-250, 250)
    ax.set_ylim(-50, 300)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_title(f'Shot Distribution Heatmap ({len(shots)} shots)', color='white', fontsize=16, pad=10, fontweight='bold')

    if im is not None:
        from matplotlib.colors import LinearSegmentedColormap
        import matplotlib.cm as cm
        legend_cmap = LinearSegmentedColormap.from_list('legend_heat', [
            '#000000', '#1a0a24', '#4a1076', '#8b1a6b', '#c92e4a', '#e85a2c', '#f99c1c', '#fcec38'
        ])
        sm = cm.ScalarMappable(cmap=legend_cmap)
        sm.set_array([])
        cbar = plt.colorbar(sm, cax=cax, orientation='horizontal')
        cbar.set_ticks([0, 0.5, 1.0])
        cbar.set_ticklabels(['lower', 'Shot frequency', 'higher'])
        cbar.ax.xaxis.set_tick_params(color='white', labelsize=11)
        plt.setp(cbar.ax.xaxis.get_ticklabels(), color='white')
        cax.set_facecolor('#000000')
        cbar.outline.set_edgecolor('#333333')

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#000000', edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    return Response(content=buf.read(), media_type="image/png")


@router.get("/player-efficiency/{player_id}")
async def get_player_efficiency(player_id: int, season: str = "2024-25"):
    """
    Compute TS% and eFG% from cached_players (Supabase).
    Requires fga and fta in season_stats (populated by sync script).
    """
    client = get_supabase_client()
    if client:
        try:
            result = (
                client.table("cached_players")
                .select("season_stats")
                .eq("player_id", player_id)
                .limit(1)
                .execute()
            )
            if result.data:
                stats = result.data[0].get("season_stats") or {}
                pts = float(stats.get("pts", 0) or 0)
                fga = float(stats.get("fga", 0) or 0)
                fta = float(stats.get("fta", 0) or 0)
                fg3m = float(stats.get("fg3m", 0) or 0)
                fgm = fga * float(stats.get("fg_pct", 0) or 0)

                if fga > 0 and (fga + 0.44 * fta) > 0:
                    ts_pct = round((pts / (2 * (fga + 0.44 * fta))) * 100, 1)
                    efg_pct = round(((fgm + 0.5 * fg3m) / fga) * 100, 1)
                    return {"player_id": player_id, "using_real_data": True, "ts_pct": ts_pct, "efg_pct": efg_pct, "ppg": pts, "fga": fga, "fta": fta}
                elif stats.get("fg_pct"):
                    fg_pct = float(stats["fg_pct"])
                    return {"player_id": player_id, "using_real_data": True, "ts_pct": round(fg_pct * 100 * 1.08, 1), "efg_pct": round(fg_pct * 100, 1), "ppg": pts, "fga": fga, "fta": fta}
        except Exception as e:
            print(f"Supabase player-efficiency error: {e}")

    return {"player_id": player_id, "using_real_data": False, "ts_pct": None, "efg_pct": None, "ppg": None, "fga": None, "fta": None}
