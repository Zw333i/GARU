/**
 * Normalize a string by removing diacritics/accents and lowercasing.
 * e.g. "Bogdanović" → "bogdanovic", "Dončić" → "doncic"
 */
function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Check if a user's guess matches a player name.
 * 
 * Accepts:
 * - Full name (first + last)
 * - First name only
 * - Last name only
 * - Partial match (substring of full name, min 3 chars)
 * 
 * Handles:
 * - Diacritics/accents (Bogdanović ↔ Bogdanovic)
 * - Short names like "GG", "CJ", "Ty" (exact first/last name match, no min length)
 * - Case insensitive
 */
export function checkGuess(guess: string, playerName: string): boolean {
  const g = normalize(guess)
  if (g.length === 0) return false

  const fullName = normalize(playerName)
  const nameParts = fullName.split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ')

  // Exact full name match
  if (g === fullName) return true

  // Exact first name match (handles "GG", "CJ", "Ty", etc.)
  if (g === firstName) return true

  // Exact last name match
  if (lastName && g === lastName) return true

  // Also match individual last name parts for multi-word last names
  // e.g. "Antetokounmpo" should match "Giannis Antetokounmpo"
  if (nameParts.length > 2) {
    for (let i = 1; i < nameParts.length; i++) {
      if (g === nameParts[i]) return true
    }
  }

  // Partial/substring match — guess is contained in full name (min 3 chars to avoid false positives)
  if (g.length >= 3 && fullName.includes(g)) return true

  return false
}
