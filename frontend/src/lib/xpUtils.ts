/**
 * XP and Leveling System Utilities
 * 
 * XP requirements scale with level:
 * - Level 1-5: 100 XP per level
 * - Level 6-10: 150 XP per level
 * - Level 11-20: 200 XP per level
 * - Level 21-30: 300 XP per level
 * - Level 31+: 400 XP per level
 */

/**
 * Get the XP required to go from level N to level N+1
 */
export function getXPForLevel(level: number): number {
  if (level <= 5) return 100
  if (level <= 10) return 150
  if (level <= 20) return 200
  if (level <= 30) return 300
  return 400
}

/**
 * Get the total XP required to reach a specific level from level 1
 */
export function getTotalXPForLevel(targetLevel: number): number {
  let totalXP = 0
  for (let level = 1; level < targetLevel; level++) {
    totalXP += getXPForLevel(level)
  }
  return totalXP
}

/**
 * Calculate the user's level based on their total XP
 */
export function calculateLevel(totalXP: number): number {
  let level = 1
  let xpAccumulator = 0
  
  while (true) {
    const xpForNextLevel = getXPForLevel(level)
    if (xpAccumulator + xpForNextLevel > totalXP) {
      return level
    }
    xpAccumulator += xpForNextLevel
    level++
  }
}

/**
 * Get XP progress toward the next level
 * Returns { currentXP, requiredXP, progressPercent }
 */
export function getXPProgress(totalXP: number): {
  currentXP: number
  requiredXP: number
  progressPercent: number
  level: number
} {
  const level = calculateLevel(totalXP)
  const xpAtLevelStart = getTotalXPForLevel(level)
  const xpForNextLevel = getXPForLevel(level)
  const currentXP = totalXP - xpAtLevelStart
  
  return {
    level,
    currentXP,
    requiredXP: xpForNextLevel,
    progressPercent: Math.min(100, Math.round((currentXP / xpForNextLevel) * 100))
  }
}

/**
 * Calculate level from XP (for display purposes)
 * This should match the database calculation
 */
export function getLevelFromTotalXP(totalXP: number): number {
  return calculateLevel(totalXP)
}
