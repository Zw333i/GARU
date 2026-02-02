"""Test NBA Service"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from services.nba_service import get_all_players, CURRENT_SEASON

print(f"Season: {CURRENT_SEASON}")
players = get_all_players()
print(f"Total players: {len(players)}")
print("Top 5 scorers:")
for p in players[:5]:
    print(f"  {p['name']} ({p['team']}): {p['pts']} PPG")
