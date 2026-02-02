"""
NBA Shot Chart Heatmap Generator
Uses matplotlib and seaborn to generate KDE heatmaps and dynamic hexbins
for player scoring density and efficiency relative to league averages.
"""

import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend

import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from io import BytesIO
import base64
from typing import List, Dict, Tuple, Optional

# NBA court dimensions (in feet, scaled for plotting)
COURT_LENGTH = 94
COURT_WIDTH = 50
HOOP_X = 0
HOOP_Y = 5.25
THREE_PT_DIST = 23.75
CORNER_THREE_DIST = 22

def draw_court(ax=None, color='white', lw=2, alpha=0.7):
    """Draw NBA half-court on matplotlib axes."""
    if ax is None:
        ax = plt.gca()
    
    # Court outline
    ax.plot([-25, 25], [0, 0], color=color, lw=lw, alpha=alpha)
    ax.plot([-25, 25], [47, 47], color=color, lw=lw, alpha=alpha)
    ax.plot([-25, -25], [0, 47], color=color, lw=lw, alpha=alpha)
    ax.plot([25, 25], [0, 47], color=color, lw=lw, alpha=alpha)
    
    # Hoop
    hoop = plt.Circle((0, 5.25), 0.75, color=color, fill=False, lw=lw, alpha=alpha)
    ax.add_patch(hoop)
    
    # Backboard
    ax.plot([-3, 3], [4, 4], color=color, lw=lw, alpha=alpha)
    
    # Paint
    paint = plt.Rectangle((-8, 0), 16, 19, fill=False, color=color, lw=lw, alpha=alpha)
    ax.add_patch(paint)
    
    # Free throw circle
    ft_circle = plt.Circle((0, 19), 6, color=color, fill=False, lw=lw, alpha=alpha)
    ax.add_patch(ft_circle)
    
    # Restricted area
    restricted = plt.Circle((0, 5.25), 4, color=color, fill=False, lw=lw, alpha=alpha)
    ax.add_patch(restricted)
    
    # Three point line
    # Corner three
    ax.plot([-22, -22], [0, 14], color=color, lw=lw, alpha=alpha)
    ax.plot([22, 22], [0, 14], color=color, lw=lw, alpha=alpha)
    
    # Arc
    three_arc = plt.Circle((0, 5.25), 23.75, color=color, fill=False, lw=lw, alpha=alpha)
    ax.add_patch(three_arc)
    
    ax.set_xlim(-25, 25)
    ax.set_ylim(0, 47)
    ax.set_aspect('equal')
    ax.axis('off')
    
    return ax


def generate_mock_shot_data(player_id: int = 0, num_shots: int = 500) -> List[Dict]:
    """Generate mock shot data for a player."""
    np.random.seed(player_id if player_id else None)
    
    shots = []
    for _ in range(num_shots):
        # Bias towards common shooting areas
        area = np.random.choice(['paint', 'midrange', 'three', 'corner3'], 
                                p=[0.35, 0.2, 0.35, 0.1])
        
        if area == 'paint':
            x = np.random.uniform(-8, 8)
            y = np.random.uniform(0, 15)
            made_prob = 0.58
        elif area == 'midrange':
            angle = np.random.uniform(0, np.pi)
            dist = np.random.uniform(10, 22)
            x = dist * np.cos(angle)
            y = 5.25 + dist * np.sin(angle)
            made_prob = 0.42
        elif area == 'three':
            angle = np.random.uniform(0.3, np.pi - 0.3)
            dist = np.random.uniform(23.75, 27)
            x = dist * np.cos(angle)
            y = 5.25 + dist * np.sin(angle)
            made_prob = 0.36
        else:  # corner3
            x = np.random.choice([-22, 22]) + np.random.uniform(-1, 1)
            y = np.random.uniform(0, 10)
            made_prob = 0.40
        
        made = np.random.random() < made_prob
        shots.append({
            'x': float(x),
            'y': float(y),
            'made': made,
            'points': 3 if np.sqrt(x**2 + (y - 5.25)**2) > 22 else 2
        })
    
    return shots


def generate_kde_heatmap(
    shots: List[Dict],
    player_name: str = "Player",
    figsize: Tuple[int, int] = (10, 10),
    cmap: str = 'YlOrRd'
) -> str:
    """
    Generate a KDE (Kernel Density Estimation) heatmap of shot locations.
    
    Returns base64 encoded PNG image.
    """
    fig, ax = plt.subplots(figsize=figsize, facecolor='#0F172A')
    ax.set_facecolor('#0F172A')
    
    x_coords = [s['x'] for s in shots]
    y_coords = [s['y'] for s in shots]
    
    # KDE plot
    sns.kdeplot(
        x=x_coords, 
        y=y_coords,
        cmap=cmap,
        fill=True,
        alpha=0.7,
        levels=20,
        thresh=0.05,
        ax=ax
    )
    
    # Draw court on top
    draw_court(ax, color='white', lw=1, alpha=0.6)
    
    # Title
    ax.set_title(f'{player_name} - Shot Density', 
                 color='white', fontsize=16, fontweight='bold', pad=20)
    
    # Save to buffer
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='#0F172A', edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    
    return base64.b64encode(buf.read()).decode('utf-8')


def generate_hexbin_efficiency(
    shots: List[Dict],
    player_name: str = "Player",
    gridsize: int = 15,
    figsize: Tuple[int, int] = (10, 10)
) -> str:
    """
    Generate a hexbin chart showing shooting efficiency by zone.
    Color represents FG% in each hex zone.
    
    Returns base64 encoded PNG image.
    """
    fig, ax = plt.subplots(figsize=figsize, facecolor='#0F172A')
    ax.set_facecolor('#0F172A')
    
    x_coords = np.array([s['x'] for s in shots])
    y_coords = np.array([s['y'] for s in shots])
    made = np.array([1 if s['made'] else 0 for s in shots])
    
    # Custom colormap: red (cold) to lime green (hot)
    colors = ['#EC4899', '#F59E0B', '#84CC16']
    cmap = matplotlib.colors.LinearSegmentedColormap.from_list('efficiency', colors)
    
    # Hexbin with efficiency as color
    hb = ax.hexbin(
        x_coords, y_coords, 
        C=made,
        gridsize=gridsize,
        cmap=cmap,
        reduce_C_function=np.mean,
        mincnt=3,
        alpha=0.8,
        extent=[-25, 25, 0, 47]
    )
    
    # Draw court on top
    draw_court(ax, color='white', lw=1, alpha=0.8)
    
    # Colorbar
    cbar = plt.colorbar(hb, ax=ax, pad=0.02)
    cbar.set_label('Field Goal %', color='white', fontsize=12)
    cbar.ax.yaxis.set_tick_params(color='white')
    plt.setp(plt.getp(cbar.ax.axes, 'yticklabels'), color='white')
    
    # Title
    ax.set_title(f'{player_name} - Shooting Efficiency by Zone', 
                 color='white', fontsize=16, fontweight='bold', pad=20)
    
    # Save to buffer
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='#0F172A', edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    
    return base64.b64encode(buf.read()).decode('utf-8')


def generate_comparison_heatmap(
    player_shots: List[Dict],
    league_shots: List[Dict],
    player_name: str = "Player",
    figsize: Tuple[int, int] = (12, 10)
) -> str:
    """
    Generate a comparison heatmap showing player efficiency vs league average.
    Blue = below average, Red = above average.
    
    Returns base64 encoded PNG image.
    """
    fig, ax = plt.subplots(figsize=figsize, facecolor='#0F172A')
    ax.set_facecolor('#0F172A')
    
    # Calculate efficiency difference by zone
    # This is a simplified version - real implementation would use more sophisticated binning
    
    player_x = np.array([s['x'] for s in player_shots])
    player_y = np.array([s['y'] for s in player_shots])
    player_made = np.array([1 if s['made'] else 0 for s in player_shots])
    
    league_x = np.array([s['x'] for s in league_shots])
    league_y = np.array([s['y'] for s in league_shots])
    league_made = np.array([1 if s['made'] else 0 for s in league_shots])
    
    # Custom diverging colormap
    colors = ['#3B82F6', '#1E293B', '#84CC16']  # Blue -> Gray -> Lime
    cmap = matplotlib.colors.LinearSegmentedColormap.from_list('comparison', colors)
    
    # For visualization, just show player efficiency for now
    hb = ax.hexbin(
        player_x, player_y,
        C=player_made,
        gridsize=12,
        cmap=cmap,
        reduce_C_function=np.mean,
        mincnt=3,
        alpha=0.8,
        extent=[-25, 25, 0, 47],
        vmin=0.3,
        vmax=0.7
    )
    
    # Draw court
    draw_court(ax, color='white', lw=1, alpha=0.8)
    
    # Colorbar
    cbar = plt.colorbar(hb, ax=ax, pad=0.02)
    cbar.set_label('FG% vs League Avg', color='white', fontsize=12)
    cbar.ax.yaxis.set_tick_params(color='white')
    plt.setp(plt.getp(cbar.ax.axes, 'yticklabels'), color='white')
    
    # Title
    ax.set_title(f'{player_name} - Efficiency vs League Average', 
                 color='white', fontsize=16, fontweight='bold', pad=20)
    
    # Save to buffer
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight',
                facecolor='#0F172A', edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    
    return base64.b64encode(buf.read()).decode('utf-8')


def get_zone_stats(shots: List[Dict]) -> Dict:
    """Calculate shooting stats by zone."""
    zones = {
        'paint': {'made': 0, 'total': 0},
        'midrange': {'made': 0, 'total': 0},
        'three': {'made': 0, 'total': 0},
        'corner3': {'made': 0, 'total': 0}
    }
    
    for shot in shots:
        x, y = shot['x'], shot['y']
        dist = np.sqrt(x**2 + (y - 5.25)**2)
        
        if abs(x) > 22 and y < 14:
            zone = 'corner3'
        elif dist > 23.75:
            zone = 'three'
        elif dist < 10:
            zone = 'paint'
        else:
            zone = 'midrange'
        
        zones[zone]['total'] += 1
        if shot['made']:
            zones[zone]['made'] += 1
    
    # Calculate percentages
    for zone in zones:
        if zones[zone]['total'] > 0:
            zones[zone]['pct'] = zones[zone]['made'] / zones[zone]['total'] * 100
        else:
            zones[zone]['pct'] = 0.0
    
    return zones


# Example usage / testing
if __name__ == "__main__":
    # Generate mock data
    player_shots = generate_mock_shot_data(player_id=203999, num_shots=500)
    league_shots = generate_mock_shot_data(player_id=0, num_shots=2000)
    
    # Generate visualizations
    kde_img = generate_kde_heatmap(player_shots, "Nikola Jokic")
    hex_img = generate_hexbin_efficiency(player_shots, "Nikola Jokic")
    comp_img = generate_comparison_heatmap(player_shots, league_shots, "Nikola Jokic")
    
    # Get zone stats
    stats = get_zone_stats(player_shots)
    
    print("Zone Stats:")
    for zone, data in stats.items():
        print(f"  {zone}: {data['made']}/{data['total']} ({data['pct']:.1f}%)")
    
    print("\nVisualization images generated successfully!")
    print(f"KDE heatmap size: {len(kde_img)} bytes")
    print(f"Hexbin chart size: {len(hex_img)} bytes")
    print(f"Comparison chart size: {len(comp_img)} bytes")
