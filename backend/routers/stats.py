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


@router.get("/shot-distribution/{player_id}")
async def get_shot_distribution(player_id: int, season: str = "2024-25"):
    """Get shot distribution by zone using REAL NBA data"""
    zones = {
        'restricted_area': {'made': 0, 'attempts': 0, 'name': 'Restricted Area'},
        'paint': {'made': 0, 'attempts': 0, 'name': 'Paint (Non-RA)'},
        'mid_range': {'made': 0, 'attempts': 0, 'name': 'Mid-Range'},
        'corner_3': {'made': 0, 'attempts': 0, 'name': 'Corner 3'},
        'above_break_3': {'made': 0, 'attempts': 0, 'name': 'Above Break 3'},
    }
    using_real_data = False
    
    try:
        from nba_api.stats.endpoints import shotchartdetail
        import time
        
        time.sleep(0.6)
        
        shot_data = shotchartdetail.ShotChartDetail(
            team_id=0,
            player_id=player_id,
            season_nullable=season,
            season_type_all_star='Regular Season',
            context_measure_simple='FGA'
        )
        
        df = shot_data.get_data_frames()[0]
        
        if len(df) > 0:
            using_real_data = True
            for _, shot in df.iterrows():
                x, y = shot['LOC_X'], shot['LOC_Y']
                made = shot['SHOT_MADE_FLAG'] == 1
                distance = (x**2 + y**2) ** 0.5
                
                # Classify shot by zone
                if y <= 50 and distance <= 40:
                    zone = 'restricted_area'
                elif y <= 190 and abs(x) <= 80:
                    zone = 'paint'
                elif distance > 237.5 or (abs(x) >= 220 and y <= 90):
                    # 3-point shot
                    if abs(x) >= 220 and y <= 90:
                        zone = 'corner_3'
                    else:
                        zone = 'above_break_3'
                else:
                    zone = 'mid_range'
                
                zones[zone]['attempts'] += 1
                if made:
                    zones[zone]['made'] += 1
            
            print(f"✅ Loaded shot distribution for player {player_id}")
    
    except Exception as e:
        print(f"⚠️ NBA API unavailable for distribution: {e}")
    
    # Calculate percentages
    total_attempts = sum(z['attempts'] for z in zones.values())
    
    result = []
    for key, zone in zones.items():
        attempts = zone['attempts']
        made = zone['made']
        result.append({
            'zone': zone['name'],
            'pct': round((attempts / total_attempts * 100), 1) if total_attempts > 0 else 0,
            'efficiency': round((made / attempts * 100), 1) if attempts > 0 else 0,
            'made': made,
            'attempts': attempts,
        })
    
    return {
        'player_id': player_id,
        'using_real_data': using_real_data,
        'total_shots': total_attempts,
        'zones': result,
    }


@router.get("/shot-chart/{player_id}")
async def get_shot_chart(player_id: int, season: str = "2024-25"):
    """Get shot chart data for a player using REAL NBA data"""
    shots = []
    using_real_data = False
    
    try:
        from nba_api.stats.endpoints import shotchartdetail
        import time
        
        time.sleep(0.6)
        
        shot_data = shotchartdetail.ShotChartDetail(
            team_id=0,
            player_id=player_id,
            season_nullable=season,
            season_type_all_star='Regular Season',
            context_measure_simple='FGA'
        )
        
        df = shot_data.get_data_frames()[0]
        
        if len(df) > 0:
            using_real_data = True
            for _, shot in df.iterrows():
                x = shot['LOC_X']
                y = shot['LOC_Y']
                made = shot['SHOT_MADE_FLAG'] == 1
                distance = (x**2 + y**2) ** 0.5
                
                shots.append({
                    "x": round(float(x), 1),
                    "y": round(float(y), 1),
                    "made": made,
                    "distance": round(distance / 10, 1),
                    "is_three": distance > 237.5 or (abs(x) >= 220 and y <= 90)
                })
            
            print(f"✅ Loaded {len(shots)} shots for player {player_id}")
    
    except Exception as e:
        print(f"⚠️ NBA API unavailable for shot chart: {e}")
        # Generate fallback mock data
        for _ in range(random.randint(100, 200)):
            x = random.uniform(-235, 235)
            y = random.uniform(50, 400)
            distance = math.sqrt(x**2 + y**2)
            
            if distance < 50:
                made = random.random() < 0.65
            elif distance < 150:
                made = random.random() < 0.40
            else:
                made = random.random() < 0.35
            
            shots.append({
                "x": round(x, 1),
                "y": round(y, 1),
                "made": made,
                "distance": round(distance / 10, 1),
                "is_three": distance > 220
            })
    
    # Calculate zone stats
    total = len(shots)
    made = len([s for s in shots if s["made"]])
    threes = [s for s in shots if s["is_three"]]
    threes_made = len([s for s in threes if s["made"]])
    
    return {
        "player_id": player_id,
        "using_real_data": using_real_data,
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


# League average FG% by zone for reference (2023-24 season averages)
LEAGUE_AVG_BY_ZONE = {
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

ZONE_NAMES = {
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


@router.get("/shot-zones/{player_id}")
async def get_shot_zones(player_id: int, season: str = "2024-25"):
    """Get hexbin shot chart zones with efficiency data using REAL NBA data"""
    zones_data: Dict[str, Dict] = {key: {'made': 0, 'attempts': 0} for key in LEAGUE_AVG_BY_ZONE.keys()}
    using_real_data = False
    total_shots = 0
    total_made = 0
    three_attempts = 0
    three_made = 0
    paint_attempts = 0
    paint_made = 0
    
    try:
        from nba_api.stats.endpoints import shotchartdetail
        import time
        
        time.sleep(0.6)
        
        shot_data = shotchartdetail.ShotChartDetail(
            team_id=0,
            player_id=player_id,
            season_nullable=season,
            season_type_all_star='Regular Season',
            context_measure_simple='FGA'
        )
        
        df = shot_data.get_data_frames()[0]
        
        if len(df) > 0:
            using_real_data = True
            
            for _, shot in df.iterrows():
                x, y = float(shot['LOC_X']), float(shot['LOC_Y'])
                made = shot['SHOT_MADE_FLAG'] == 1
                distance = (x**2 + y**2) ** 0.5
                
                total_shots += 1
                if made:
                    total_made += 1
                
                # Classify by zone
                zone_key = classify_shot_zone(x, y, distance)
                
                if zone_key in zones_data:
                    zones_data[zone_key]['attempts'] += 1
                    if made:
                        zones_data[zone_key]['made'] += 1
                
                # Track 3pt and paint separately
                if distance > 237.5 or (abs(x) >= 220 and y <= 90):
                    three_attempts += 1
                    if made:
                        three_made += 1
                elif distance <= 80:
                    paint_attempts += 1
                    if made:
                        paint_made += 1
            
            print(f"✅ Loaded {total_shots} shots for hexbin zones for player {player_id}")
    
    except Exception as e:
        print(f"⚠️ NBA API unavailable for shot zones: {e}")
    
    # Build response zones
    result_zones = []
    for zone_key, data in zones_data.items():
        if data['attempts'] > 0:
            pct = (data['made'] / data['attempts']) * 100
            # Determine size based on frequency
            if total_shots > 0:
                freq = data['attempts'] / total_shots
                if freq > 0.10:
                    size = 'high'
                elif freq > 0.04:
                    size = 'med'
                else:
                    size = 'low'
            else:
                size = 'low'
            
            result_zones.append({
                'zone': ZONE_NAMES.get(zone_key, zone_key),
                'zone_key': zone_key,
                'made': data['made'],
                'attempts': data['attempts'],
                'pct': round(pct, 1),
                'league_avg': LEAGUE_AVG_BY_ZONE.get(zone_key, 40.0),
                'size': size,
            })
    
    return {
        'player_id': player_id,
        'using_real_data': using_real_data,
        'total_shots': total_shots,
        'fg_pct': round((total_made / total_shots) * 100, 1) if total_shots > 0 else 0,
        'three_pct': round((three_made / three_attempts) * 100, 1) if three_attempts > 0 else 0,
        'paint_pct': round((paint_made / paint_attempts) * 100, 1) if paint_attempts > 0 else 0,
        'zones': result_zones,
    }


def classify_shot_zone(x: float, y: float, distance: float) -> str:
    """Classify a shot into a specific zone based on coordinates"""
    # Restricted area
    if y <= 50 and distance <= 40:
        return 'restricted_area'
    
    # Paint (non-restricted)
    if y <= 190 and abs(x) <= 80:
        if x < -25:
            return 'paint_left'
        elif x > 25:
            return 'paint_right'
        else:
            return 'paint_center'
    
    # 3-point shots
    is_three = distance > 237.5 or (abs(x) >= 220 and y <= 90)
    
    if is_three:
        # Corner 3s
        if y <= 90:
            return 'corner_3_left' if x < 0 else 'corner_3_right'
        # Above break 3s
        if abs(x) > 130:
            return 'above_break_3_left' if x < 0 else 'above_break_3_right'
        elif abs(x) > 50:
            return 'above_break_3_center_left' if x < 0 else 'above_break_3_center_right'
        else:
            return 'above_break_3_center'
    
    # Mid-range
    if y <= 100:
        return 'mid_left_baseline' if x < 0 else 'mid_right_baseline'
    elif abs(x) > 100:
        return 'mid_left' if x < 0 else 'mid_right'
    elif abs(x) > 40:
        return 'mid_center_left' if x < 0 else 'mid_center_right'
    else:
        return 'mid_center'


@router.get("/player-efficiency/{player_id}")
async def get_player_efficiency(player_id: int, season: str = "2024-25"):
    """Get player efficiency stats (TS%, eFG%, etc.) using REAL NBA data"""
    using_real_data = False
    efficiency = {
        "ts_pct": 55.0,
        "efg_pct": 50.0,
        "ppg": 15.0,
        "fga": 10.0,
        "fta": 3.0
    }
    
    try:
        from nba_api.stats.endpoints import playerdashboardbygeneralsplits
        import time
        
        time.sleep(0.6)
        
        dashboard = playerdashboardbygeneralsplits.PlayerDashboardByGeneralSplits(
            player_id=player_id,
            season=season,
            season_type_playoffs='Regular Season'
        )
        
        df = dashboard.get_data_frames()[0]
        
        if len(df) > 0:
            using_real_data = True
            row = df.iloc[0]
            
            pts = float(row.get('PTS', 0))
            fga = float(row.get('FGA', 1))
            fta = float(row.get('FTA', 0))
            fgm = float(row.get('FGM', 0))
            fg3m = float(row.get('FG3M', 0))
            gp = float(row.get('GP', 1))
            
            # True Shooting %
            if fga + 0.44 * fta > 0:
                ts_pct = (pts / (2 * (fga + 0.44 * fta))) * 100
            else:
                ts_pct = 0
            
            # Effective FG %
            if fga > 0:
                efg_pct = ((fgm + 0.5 * fg3m) / fga) * 100
            else:
                efg_pct = 0
            
            efficiency = {
                "ts_pct": round(ts_pct, 1),
                "efg_pct": round(efg_pct, 1),
                "ppg": round(pts / gp, 1) if gp > 0 else 0,
                "fga": round(fga / gp, 1) if gp > 0 else 0,
                "fta": round(fta / gp, 1) if gp > 0 else 0
            }
            
            print(f"✅ Loaded efficiency for player {player_id}: TS% = {ts_pct:.1f}")
    
    except Exception as e:
        print(f"⚠️ NBA API unavailable for efficiency: {e}")
    
    return {
        "player_id": player_id,
        "using_real_data": using_real_data,
        **efficiency
    }


@router.get("/heatmap/{player_id}")
async def get_player_heatmap(player_id: int, season: str = "2024-25"):
    """Generate a KDE heatmap image using REAL NBA shot data"""
    if not HAS_VISUALIZATION:
        raise HTTPException(
            status_code=500, 
            detail="Visualization libraries not installed. Run: pip install matplotlib numpy scipy"
        )
    
    # Try to get real shot data from NBA API
    shots_x = []
    shots_y = []
    using_real_data = False
    
    try:
        from nba_api.stats.endpoints import shotchartdetail
        import time
        
        # Rate limiting
        time.sleep(0.6)
        
        # Fetch real shot data from NBA API
        shot_data = shotchartdetail.ShotChartDetail(
            team_id=0,
            player_id=player_id,
            season_nullable=season,
            season_type_all_star='Regular Season',
            context_measure_simple='FGA'
        )
        
        df = shot_data.get_data_frames()[0]
        
        if len(df) > 0:
            # NBA API returns LOC_X and LOC_Y in tenths of feet from center
            # LOC_X: negative = left, positive = right
            # LOC_Y: distance from basket
            shots_x = df['LOC_X'].tolist()
            shots_y = df['LOC_Y'].tolist()
            using_real_data = True
            print(f"✅ Loaded {len(shots_x)} real shots for player {player_id}")
        
    except Exception as e:
        print(f"⚠️ NBA API unavailable, using simulated data: {e}")
    
    # Fallback to simulated data if no real data available
    if not using_real_data or len(shots_x) < 20:
        rng = np.random.default_rng(seed=player_id)
        
        # Player archetype based on ID
        archetype_seed = player_id % 10
        if archetype_seed < 3:
            zone_probs = [0.20, 0.10, 0.50, 0.20]
        elif archetype_seed < 5:
            zone_probs = [0.55, 0.20, 0.15, 0.10]
        elif archetype_seed < 7:
            zone_probs = [0.25, 0.40, 0.25, 0.10]
        else:
            zone_probs = [0.35, 0.20, 0.30, 0.15]
        
        n_shots = rng.integers(250, 450)
        shots_x = []
        shots_y = []
        
        for _ in range(n_shots):
            zone = rng.choice(['paint', 'midrange', 'three', 'corner3'], p=zone_probs)
            
            if zone == 'paint':
                x = rng.normal(0, 35 + (player_id % 10))
                y = rng.normal(55 + (player_id % 20), 28)
            elif zone == 'midrange':
                angle = rng.uniform(0.1, np.pi - 0.1)
                r = rng.uniform(90, 190)
                x = r * np.cos(angle) - r/2 + rng.normal(0, 18)
                y = r * np.sin(angle) + rng.normal(35, 18)
            elif zone == 'three':
                angle_offset = (player_id % 5) * 0.15
                angle = rng.uniform(0.25 + angle_offset, np.pi - 0.25 - angle_offset)
                r = rng.uniform(225, 265)
                x = r * np.cos(angle) - r/2 + rng.normal(0, 12)
                y = r * np.sin(angle) + rng.normal(0, 12)
            else:  # corner3
                side = rng.choice([-1, 1])
                if player_id % 2 == 0 and rng.random() > 0.3:
                    side = 1
                elif player_id % 2 == 1 and rng.random() > 0.3:
                    side = -1
                x = side * rng.uniform(205, 225)
                y = rng.uniform(5, 70)
            
            # Clamp to court bounds
            x = np.clip(x, -250, 250)
            y = np.clip(y, -50, 400)
            shots_x.append(x)
            shots_y.append(y)
    
    shots_x = np.array(shots_x)
    shots_y = np.array(shots_y)
    
    # Create the heatmap with black background - BIGGER figure
    fig = plt.figure(figsize=(12, 11), facecolor='#000000')
    
    # Use gridspec for layout - main court on top, legend below
    gs = fig.add_gridspec(2, 1, height_ratios=[10, 1], hspace=0.05)
    ax = fig.add_subplot(gs[0])
    cax = fig.add_subplot(gs[1])
    
    ax.set_facecolor('#000000')
    
    # Court outline color (light gray/white like reference)
    court_color = '#AAAAAA'
    court_lw = 1.5
    
    # Create KDE heatmap FIRST (so court lines are drawn on top)
    try:
        xy = np.vstack([shots_x, shots_y])
        # Use larger bandwidth for smooth, flowing heat zones (not discrete blobs)
        kde = scipy_stats.gaussian_kde(xy, bw_method=0.25)
        
        # Create high-resolution grid for smooth heatmap
        x_grid = np.linspace(-250, 250, 500)
        y_grid = np.linspace(-50, 300, 438)
        X, Y = np.meshgrid(x_grid, y_grid)
        Z = kde(np.vstack([X.ravel(), Y.ravel()])).reshape(X.shape)
        
        # Apply power transform to enhance mid-range visibility
        Z_power = np.power(Z, 0.5)  # Boost lower density areas
        
        # Normalize to 0-1 range
        Z_min = Z_power.min()
        Z_max = Z_power.max()
        if Z_max > Z_min:
            Z_norm = (Z_power - Z_min) / (Z_max - Z_min)
        else:
            Z_norm = Z_power
        
        # Use inferno colormap (black -> purple -> red -> orange -> yellow)
        # Create custom colormap that starts from black for smooth blend
        from matplotlib.colors import LinearSegmentedColormap
        colors = [
            (0.0, '#000000'),   # Black at 0
            (0.1, '#1a0a24'),   # Very dark purple
            (0.25, '#4a1076'),  # Dark purple
            (0.4, '#8b1a6b'),   # Purple-magenta
            (0.55, '#c92e4a'),  # Red
            (0.7, '#e85a2c'),   # Orange-red
            (0.85, '#f99c1c'),  # Orange
            (1.0, '#fcec38')    # Yellow
        ]
        cmap = LinearSegmentedColormap.from_list('smooth_heat', 
            [(pos, col) for pos, col in colors])
        
        # Use contourf for smooth filled contours like reference image
        levels = 50  # Many levels for smooth gradients
        im = ax.contourf(X, Y, Z_norm, levels=levels, cmap=cmap, antialiased=True)
        
    except Exception:
        im = None
    
    # Draw court lines ON TOP of heatmap
    # Three-point arc (radius 237.5, centered at basket which is at y=0)
    theta = np.linspace(np.arcsin(90/237.5), np.pi - np.arcsin(90/237.5), 100)
    arc_x = 237.5 * np.cos(theta)
    arc_y = 237.5 * np.sin(theta)
    ax.plot(arc_x, arc_y, color=court_color, linewidth=court_lw, zorder=10)
    
    # Corner three lines (from baseline to where arc starts)
    ax.plot([-220, -220], [-47.5, 90], color=court_color, linewidth=court_lw, zorder=10)
    ax.plot([220, 220], [-47.5, 90], color=court_color, linewidth=court_lw, zorder=10)
    
    # Paint (key) - 16ft wide, 19ft long
    paint_width = 80
    paint_height = 190
    ax.plot([-paint_width, -paint_width], [-47.5, paint_height - 47.5], color=court_color, linewidth=court_lw, zorder=10)
    ax.plot([paint_width, paint_width], [-47.5, paint_height - 47.5], color=court_color, linewidth=court_lw, zorder=10)
    ax.plot([-paint_width, paint_width], [paint_height - 47.5, paint_height - 47.5], color=court_color, linewidth=court_lw, zorder=10)
    
    # Free throw circle (6ft radius)
    ft_theta = np.linspace(0, np.pi, 50)
    ft_x = 60 * np.cos(ft_theta)
    ft_y = 60 * np.sin(ft_theta) + paint_height - 47.5
    ax.plot(ft_x, ft_y, color=court_color, linewidth=court_lw, zorder=10)
    
    # Dashed bottom of free throw circle
    ft_theta_bottom = np.linspace(np.pi, 2*np.pi, 50)
    ft_x_bottom = 60 * np.cos(ft_theta_bottom)
    ft_y_bottom = 60 * np.sin(ft_theta_bottom) + paint_height - 47.5
    ax.plot(ft_x_bottom, ft_y_bottom, color=court_color, linewidth=court_lw, linestyle='--', alpha=0.5, zorder=10)
    
    # Restricted area arc (4ft radius)
    ra_theta = np.linspace(0, np.pi, 50)
    ra_x = 40 * np.cos(ra_theta)
    ra_y = 40 * np.sin(ra_theta)
    ax.plot(ra_x, ra_y, color=court_color, linewidth=court_lw, zorder=10)
    
    # Rim (basket - small circle)
    rim = plt.Circle((0, 0), 7.5, fill=False, color=court_color, linewidth=2, zorder=10)
    ax.add_patch(rim)
    
    # Backboard
    ax.plot([-30, 30], [-7.5, -7.5], color=court_color, linewidth=3, zorder=10)
    
    # Style
    ax.set_xlim(-250, 250)
    ax.set_ylim(-50, 300)
    ax.set_aspect('equal')
    ax.axis('off')
    
    # Title
    data_label = f"({len(shots_x)} shots)" if using_real_data else "(simulated)"
    ax.set_title(f'Shot Distribution Heatmap {data_label}', color='white', fontsize=16, pad=10, fontweight='bold')
    
    # Horizontal colorbar at bottom - use opaque version for legend
    if im is not None:
        # Create an opaque colormap matching the heatmap colors
        from matplotlib.colors import LinearSegmentedColormap
        legend_colors = ['#000000', '#1a0a24', '#4a1076', '#8b1a6b', '#c92e4a', '#e85a2c', '#f99c1c', '#fcec38']
        legend_cmap = LinearSegmentedColormap.from_list('legend_heat', legend_colors)
        
        # Create a dummy ScalarMappable for the legend colorbar
        import matplotlib.cm as cm
        sm = cm.ScalarMappable(cmap=legend_cmap)
        sm.set_array([])
        
        cbar = plt.colorbar(sm, cax=cax, orientation='horizontal')
        cbar.ax.xaxis.set_tick_params(color='white')
        cbar.outline.set_edgecolor('white')
        cbar.ax.tick_params(labelsize=0)  # Hide tick labels
        
        # Add "lower" and "higher" labels
        cax.set_facecolor('#000000')
        cax.text(0.0, -0.5, 'lower', transform=cax.transAxes, color='white', fontsize=11, ha='left', va='top')
        cax.text(1.0, -0.5, 'higher', transform=cax.transAxes, color='white', fontsize=11, ha='right', va='top')
        cax.text(0.5, -0.5, 'Shot frequency', transform=cax.transAxes, color='white', fontsize=11, ha='center', va='top')
    else:
        cax.axis('off')
    
    # Save to bytes - higher DPI for quality
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight', 
                facecolor='#000000', edgecolor='none', pad_inches=0.15)
    plt.close(fig)
    buf.seek(0)
    
    # Return with cache-prevention headers
    return Response(
        content=buf.getvalue(), 
        media_type="image/png",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Player-ID": str(player_id)  # Debug header to verify different players
        }
    )


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
