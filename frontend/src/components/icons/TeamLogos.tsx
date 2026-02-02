// NBA Team Logos - using SVG files from /public/teams/
import React from 'react'
import Image from 'next/image'

interface TeamLogoProps {
  className?: string
  size?: number
}

interface DynamicTeamLogoProps extends TeamLogoProps {
  team: string
}

// Team abbreviation to full name mapping
const teamNameMap: Record<string, string> = {
  'ATL': 'Atlanta Hawks',
  'BOS': 'Boston Celtics',
  'BKN': 'Brooklyn Nets',
  'CHA': 'Charlotte Hornets',
  'CHI': 'Chicago Bulls',
  'CLE': 'Cleveland Cavaliers',
  'DAL': 'Dallas Mavericks',
  'DEN': 'Denver Nuggets',
  'DET': 'Detroit Pistons',
  'GSW': 'Golden State Warriors',
  'HOU': 'Houston Rockets',
  'IND': 'Indiana Pacers',
  'LAC': 'LA Clippers',
  'LAL': 'Los Angeles Lakers',
  'MEM': 'Memphis Grizzlies',
  'MIA': 'Miami Heat',
  'MIL': 'Milwaukee Bucks',
  'MIN': 'Minnesota Timberwolves',
  'NOP': 'New Orleans Pelicans',
  'NYK': 'New York Knicks',
  'OKC': 'Oklahoma City Thunder',
  'ORL': 'Orlando Magic',
  'PHI': 'Philadelphia 76ers',
  'PHX': 'Phoenix Suns',
  'POR': 'Portland Trail Blazers',
  'SAC': 'Sacramento Kings',
  'SAS': 'San Antonio Spurs',
  'TOR': 'Toronto Raptors',
  'UTA': 'Utah Jazz',
  'WAS': 'Washington Wizards',
  // Legacy team mappings
  'NJN': 'Brooklyn Nets',  // New Jersey Nets -> Brooklyn Nets
  'SEA': 'Oklahoma City Thunder',  // Seattle SuperSonics -> OKC
  'VAN': 'Memphis Grizzlies',  // Vancouver Grizzlies -> Memphis
  'CHH': 'Charlotte Hornets',  // Charlotte Hornets (original)
  'NOH': 'New Orleans Pelicans',  // New Orleans Hornets
  'NOK': 'New Orleans Pelicans',  // New Orleans/Oklahoma City Hornets
  'KCK': 'Sacramento Kings',  // Kansas City Kings
  'SDC': 'LA Clippers',  // San Diego Clippers
}

// Dynamic TeamLogo component that loads from public folder
export const TeamLogo: React.FC<DynamicTeamLogoProps> = ({ 
  team, 
  className = '', 
  size = 48 
}) => {
  const teamName = teamNameMap[team.toUpperCase()] || team
  const svgPath = `/teams/${encodeURIComponent(teamName)}.svg`
  const pngPath = `/teams/${encodeURIComponent(teamName)}.png`
  
  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={svgPath}
        alt={teamName}
        width={size}
        height={size}
        className="object-contain"
        onError={(e) => {
          // Fallback to PNG if SVG fails
          const target = e.target as HTMLImageElement
          if (!target.src.includes('.png')) {
            target.src = pngPath
          }
        }}
        unoptimized // SVGs don't need optimization
      />
    </div>
  )
}

// Team colors for fallback styling
export const teamColors: Record<string, { primary: string; secondary: string }> = {
  'ATL': { primary: '#E03A3E', secondary: '#C1D32F' },
  'BOS': { primary: '#007A33', secondary: '#BA9653' },
  'BKN': { primary: '#000000', secondary: '#FFFFFF' },
  'CHA': { primary: '#1D1160', secondary: '#00788C' },
  'CHI': { primary: '#CE1141', secondary: '#000000' },
  'CLE': { primary: '#860038', secondary: '#FDBB30' },
  'DAL': { primary: '#00538C', secondary: '#002B5E' },
  'DEN': { primary: '#0E2240', secondary: '#FEC524' },
  'DET': { primary: '#C8102E', secondary: '#1D42BA' },
  'GSW': { primary: '#1D428A', secondary: '#FFC72C' },
  'HOU': { primary: '#CE1141', secondary: '#000000' },
  'IND': { primary: '#002D62', secondary: '#FDBB30' },
  'LAC': { primary: '#C8102E', secondary: '#1D428A' },
  'LAL': { primary: '#552583', secondary: '#FDB927' },
  'MEM': { primary: '#5D76A9', secondary: '#12173F' },
  'MIA': { primary: '#98002E', secondary: '#000000' },
  'MIL': { primary: '#00471B', secondary: '#EEE1C6' },
  'MIN': { primary: '#0C2340', secondary: '#236192' },
  'NOP': { primary: '#0C2340', secondary: '#C8102E' },
  'NYK': { primary: '#006BB6', secondary: '#F58426' },
  'OKC': { primary: '#007AC1', secondary: '#EF3B24' },
  'ORL': { primary: '#0077C0', secondary: '#000000' },
  'PHI': { primary: '#006BB6', secondary: '#ED174C' },
  'PHX': { primary: '#1D1160', secondary: '#E56020' },
  'POR': { primary: '#E03A3E', secondary: '#000000' },
  'SAC': { primary: '#5A2D81', secondary: '#63727A' },
  'SAS': { primary: '#C4CED4', secondary: '#000000' },
  'TOR': { primary: '#CE1141', secondary: '#000000' },
  'UTA': { primary: '#002B5C', secondary: '#00471B' },
  'WAS': { primary: '#002B5C', secondary: '#E31837' },
}

// Export the team name map for other components
export { teamNameMap }
