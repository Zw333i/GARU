'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const statDefinitions = [
  // LEBRON & Modern Analytics
  {
    abbr: 'LEBRON',
    name: 'Luck-adjusted player Estimate using a Box prior Regularized ON-off',
    description: 'An advanced all-in-one metric developed by BBall Index that estimates a player\'s impact on winning. It combines box score stats with on/off data, adjusted for teammate and opponent strength, and regularized using prior expectations.',
    example: 'LEBRON of +3.0 means the player adds ~3 points per 100 possessions above replacement. Elite players: +6.0+. Jokić led with +8.5 in 2023-24.',
    category: 'Modern',
  },
  {
    abbr: 'RAPTOR',
    name: 'Robust Algorithm (using) Player Tracking (and) On/Off Ratings',
    description: 'FiveThirtyEight\'s player rating system that blends box score stats with tracking data and plus-minus. Breaks down into offensive (RAPTOR O) and defensive (RAPTOR D) components.',
    example: 'Total RAPTOR of +5.0 is All-Star level. +8.0+ is MVP-caliber.',
    category: 'Modern',
  },
  {
    abbr: 'EPM',
    name: 'Estimated Plus-Minus',
    description: 'Dunks & Threes\' player impact metric that estimates a player\'s contribution to team performance using a combination of box score data, tracking data, and plus-minus information.',
    example: 'EPM of +4.0 is excellent. +6.0+ indicates an elite two-way player.',
    category: 'Modern',
  },
  {
    abbr: 'WAR',
    name: 'Wins Above Replacement',
    description: 'Estimates the number of wins a player adds to their team compared to a replacement-level player (minimum contract bench player). Derived from various plus-minus metrics.',
    example: 'WAR of 10+ is MVP-caliber. 5-10 is All-Star level. Jokić has led the league multiple times.',
    category: 'Modern',
  },
  // Classic Advanced Stats
  {
    abbr: 'PER',
    name: 'Player Efficiency Rating',
    description: 'A measure of per-minute production standardized so that the league average is 15. Created by John Hollinger, it accounts for positive accomplishments minus negative accomplishments, adjusted for pace.',
    example: 'PER of 25+ is considered MVP-level. Nikola Jokić led the league with 31.3 PER in 2021-22. Career leaders: Jordan (27.9), LeBron (27.3).',
    category: 'Advanced',
  },
  {
    abbr: 'TS%',
    name: 'True Shooting Percentage',
    description: 'The most accurate measure of shooting efficiency, accounting for 2-point field goals, 3-point field goals, and free throws. Unlike FG%, it properly weights the extra value of 3s and the "free" nature of free throws.',
    formula: 'TS% = PTS / (2 × (FGA + 0.44 × FTA))',
    example: 'League average: ~57%. Elite shooters (60%+): Curry, Durant, Jokić. The 0.44 factor accounts for and-ones and technical FTs.',
    category: 'Shooting',
  },
  {
    abbr: 'USG%',
    name: 'Usage Rate',
    description: 'An estimate of the percentage of team plays used by a player while on the floor, ending in a FGA, FTA, or turnover. High usage indicates offensive burden but doesn\'t measure efficiency.',
    formula: 'USG% = ((FGA + 0.44 × FTA + TOV) × Team Minutes) / (Minutes × Team Possessions)',
    example: 'Ball-dominant players like Luka Dončić (37%+) and Westbrook\'s MVP season (41%) have extreme usage. League average: ~20%.',
    category: 'Advanced',
  },
  {
    abbr: 'BPM',
    name: 'Box Plus/Minus',
    description: 'A box score estimate of the points per 100 possessions a player contributes above league average, translated to an average team. Includes OBPM (offensive) and DBPM (defensive) components.',
    example: '+5 is excellent, +10 is MVP-level. LeBron and Jordan have the highest career BPM.',
    category: 'Advanced',
  },
  {
    abbr: 'VORP',
    name: 'Value Over Replacement Player',
    description: 'Converts BPM into an accumulated counting stat. Estimates the points per 100 possessions above a replacement-level player (-2.0 BPM), pro-rated to an 82-game season.',
    formula: 'VORP = (BPM + 2.0) × (% of Team Minutes) × (Team Games / 82)',
    example: 'Higher is better. 4+ is All-Star level. LeBron\'s career VORP is the highest in NBA history.',
    category: 'Advanced',
  },
  {
    abbr: 'WS',
    name: 'Win Shares',
    description: 'An estimate of the number of wins contributed by a player, splitting credit between offense (OWS) and defense (DWS). A full season with 48 minutes/game and league-avg efficiency = ~6 WS.',
    example: 'Kareem has the most career WS (273). Season record: Curry with 17.9 WS in 2015-16.',
    category: 'Advanced',
  },
  {
    abbr: 'WS/48',
    name: 'Win Shares per 48 Minutes',
    description: 'Win Shares normalized per 48 minutes of play. Removes the advantage of playing more minutes, allowing comparison across eras and roles.',
    example: 'League average: ~0.100. Elite: 0.200+. Jordan career: 0.250 (highest among stars).',
    category: 'Advanced',
  },
  // Shooting Stats
  {
    abbr: 'eFG%',
    name: 'Effective Field Goal Percentage',
    description: 'Adjusts field goal percentage to account for the extra value of 3-point shots. A made 3-pointer is worth 50% more than a made 2-pointer, so this gives proper credit.',
    formula: 'eFG% = (FGM + 0.5 × 3PM) / FGA',
    example: 'League average: ~54%. Elite shooters: 58%+. Useful for comparing guards vs bigs.',
    category: 'Shooting',
  },
  {
    abbr: '3PAr',
    name: 'Three-Point Attempt Rate',
    description: 'The percentage of field goal attempts that are 3-pointers. Shows a player\'s shot selection tendency and how "modern" their game is.',
    formula: '3PAr = 3PA / FGA',
    example: 'League average has risen from ~20% (2010) to ~40%+ (2024). Curry pioneered the modern high-volume 3PA approach.',
    category: 'Shooting',
  },
  {
    abbr: 'FTr',
    name: 'Free Throw Rate',
    description: 'Free throw attempts per field goal attempt. Measures how often a player gets to the line relative to their shot volume.',
    formula: 'FTr = FTA / FGA',
    example: 'Harden and Embiid typically have FTr > 0.400. Shooters like Curry ~0.250.',
    category: 'Shooting',
  },
  // Playmaking
  {
    abbr: 'AST%',
    name: 'Assist Percentage',
    description: 'An estimate of the percentage of teammate field goals a player assisted while on the floor. High AST% indicates a primary playmaker.',
    formula: 'AST% = AST / (((MP / (Team MP / 5)) × Team FGM) - FGM)',
    example: 'Point guards: 25-40%. Trae Young and Chris Paul have elite 40%+ AST%.',
    category: 'Playmaking',
  },
  {
    abbr: 'AST/TO',
    name: 'Assist-to-Turnover Ratio',
    description: 'Simple ratio measuring passing efficiency. How many assists does a player dish for each turnover they commit?',
    example: 'Chris Paul career: 4.0+ (elite). Average PG: 2.0-3.0. Under 1.5 is concerning.',
    category: 'Playmaking',
  },
  {
    abbr: 'TOV%',
    name: 'Turnover Percentage',
    description: 'An estimate of turnovers per 100 plays. Lower is better. Important to consider alongside usage—high-usage players often have higher TOV%.',
    formula: 'TOV% = TOV / (FGA + 0.44 × FTA + TOV)',
    example: 'League average: ~13%. Elite ball security: <10%. High-usage passers: 15-18%.',
    category: 'Playmaking',
  },
  // Team/Impact Stats
  {
    abbr: 'ORTG',
    name: 'Offensive Rating',
    description: 'Points produced per 100 possessions. For players, estimates their individual offensive efficiency. For teams, measures overall offensive output.',
    example: 'League average: ~115. Elite individual ORTG: 120+. Historic offenses (2023 Kings): 118+.',
    category: 'Team',
  },
  {
    abbr: 'DRTG',
    name: 'Defensive Rating',
    description: 'Points allowed per 100 possessions. Lower is better. For players, it\'s harder to isolate individual impact on defense.',
    example: 'League average: ~115. Elite team defense (sub-110). Individual DRTG is less reliable than team DRTG.',
    category: 'Team',
  },
  {
    abbr: 'NetRTG',
    name: 'Net Rating',
    description: 'The difference between offensive and defensive rating. Shows point differential per 100 possessions—the simplest measure of overall team strength.',
    formula: 'NetRTG = ORTG - DRTG',
    example: '+5 NetRTG = excellent team. +10 = historically elite. The 73-win Warriors had +10.8 NetRTG.',
    category: 'Team',
  },
  {
    abbr: 'PIE',
    name: 'Player Impact Estimate',
    description: 'NBA\'s official measure of a player\'s overall statistical contribution against the total statistics in games they play in. Quick snapshot of game involvement.',
    example: 'Average: ~10%. All-Stars: 15%+. MVP candidates: 18%+.',
    category: 'Team',
  },
  // Rebounding & Defense
  {
    abbr: 'TRB%',
    name: 'Total Rebound Percentage',
    description: 'An estimate of the percentage of available rebounds a player grabbed while on the floor. Combines offensive (ORB%) and defensive (DRB%) rebounding.',
    example: 'Elite rebounders: 20%+ TRB%. Rodman peak: 29.7% (insane). Guards typically: 5-10%.',
    category: 'Rebounding',
  },
  {
    abbr: 'STL%',
    name: 'Steal Percentage',
    description: 'An estimate of the percentage of opponent possessions that end with a steal by this player.',
    example: 'League average: ~1.5%. Elite: 2.5%+. All-time leaders: Alvin Robertson, Chris Paul.',
    category: 'Defense',
  },
  {
    abbr: 'BLK%',
    name: 'Block Percentage',
    description: 'An estimate of the percentage of opponent 2-point attempts blocked by this player while on floor.',
    example: 'Elite rim protectors: 5%+. Wembanyama, Gobert elite. Guards typically <1%.',
    category: 'Defense',
  },
  // Additional Advanced Stats
  {
    abbr: 'OBPM',
    name: 'Offensive Box Plus/Minus',
    description: 'The offensive component of BPM. Estimates a player\'s offensive contribution in points per 100 possessions above league average using only box score stats.',
    example: '+4.0 OBPM is elite offensive player. Curry, Jokić, Dončić lead in this metric.',
    category: 'Advanced',
  },
  {
    abbr: 'DBPM',
    name: 'Defensive Box Plus/Minus',
    description: 'The defensive component of BPM. Harder to estimate from box score than offense. Uses steals, blocks, and rebounds as proxies for defensive impact.',
    example: '+3.0 DBPM is elite defender. Historically, Duncan, Garnett, and Draymond excel here.',
    category: 'Defense',
  },
  {
    abbr: 'DWS',
    name: 'Defensive Win Shares',
    description: 'The portion of Win Shares attributed to a player\'s defensive performance. Based on team defensive rating and individual defensive stats.',
    example: '3+ DWS is excellent. Gobert routinely leads the league in DWS.',
    category: 'Defense',
  },
  {
    abbr: 'OWS',
    name: 'Offensive Win Shares',
    description: 'The portion of Win Shares attributed to a player\'s offensive performance. Based on points produced and efficiency relative to league average.',
    example: '8+ OWS is All-Star caliber. Jokić, Embiid often lead in OWS.',
    category: 'Advanced',
  },
  {
    abbr: 'PPP',
    name: 'Points Per Possession',
    description: 'The average number of points scored per offensive possession. Can be calculated for players, lineups, or teams on various play types.',
    example: 'League average: ~1.10 PPP. Elite scorers in isolation: 1.15+ PPP.',
    category: 'Team',
  },
  {
    abbr: 'PACE',
    name: 'Pace Factor',
    description: 'An estimate of the number of possessions per 48 minutes by a team. Higher pace = more possessions = more scoring opportunities.',
    formula: 'PACE = 48 × ((Team Poss + Opp Poss) / (2 × (Team MP / 5)))',
    example: 'League average: ~100. Fast teams (Sacramento): 102+. Slow teams: <98.',
    category: 'Team',
  },
  {
    abbr: 'SOS',
    name: 'Strength of Schedule',
    description: 'A measure of the difficulty of a team\'s schedule based on opponents\' winning percentages. Adjusts for home/away splits.',
    example: 'Positive SOS = harder schedule. Important for comparing teams with different opponents.',
    category: 'Team',
  },
  {
    abbr: 'CATCH%',
    name: 'Catch & Shoot Percentage',
    description: 'Field goal percentage on catch-and-shoot opportunities where the player receives a pass and immediately shoots without dribbling.',
    example: 'Elite shooters: 42%+ on catch-and-shoot 3s. Klay Thompson is the gold standard.',
    category: 'Shooting',
  },
  {
    abbr: 'RIM%',
    name: 'Rim Protection Percentage',
    description: 'The field goal percentage opponents shoot when a defender is the closest defender at the rim (within 6 feet of the basket).',
    example: 'Elite rim protectors hold opponents under 55%. Gobert, Wembanyama excel here.',
    category: 'Defense',
  },
  {
    abbr: 'CONT%',
    name: 'Contested Shot Percentage',
    description: 'The percentage of a defender\'s assignments that result in a contested shot (defender within 4 feet of shooter).',
    example: 'Higher is better for defenders. Elite perimeter defenders: 75%+ contested.',
    category: 'Defense',
  },
]

const categories = ['All', 'Modern', 'Advanced', 'Shooting', 'Playmaking', 'Team', 'Rebounding', 'Defense']

export function StatGlossary() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [expandedStat, setExpandedStat] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredStats = statDefinitions.filter(stat => {
    const matchesCategory = selectedCategory === 'All' || stat.category === selectedCategory
    const matchesSearch = stat.abbr.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         stat.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-2xl p-6"
    >
      <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2">
        <span className="text-2xl">📖</span>
        Stat Glossary
      </h2>

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search stats..."
        className="w-full px-4 py-2 mb-4 bg-gunmetal border border-surface rounded-lg text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors text-sm"
      />

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              selectedCategory === category
                ? 'bg-electric-lime text-deep-void'
                : 'bg-gunmetal text-muted hover:text-ghost-white'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Stats List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredStats.map((stat) => (
          <div key={stat.abbr}>
            <button
              onClick={() => setExpandedStat(expandedStat === stat.abbr ? null : stat.abbr)}
              className="w-full flex items-center justify-between p-3 bg-gunmetal rounded-lg hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-electric-lime font-bold font-mono">{stat.abbr}</span>
                <span className="text-sm">{stat.name}</span>
              </div>
              <svg
                className={`w-4 h-4 text-muted transition-transform ${
                  expandedStat === stat.abbr ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {expandedStat === stat.abbr && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-surface/50 rounded-b-lg text-sm space-y-2">
                    <p className="text-ghost-white">{stat.description}</p>
                    {stat.formula && (
                      <p className="text-muted font-mono text-xs bg-gunmetal px-2 py-1 rounded">
                        {stat.formula}
                      </p>
                    )}
                    {stat.example && (
                      <p className="text-electric-lime text-xs">
                        💡 {stat.example}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
