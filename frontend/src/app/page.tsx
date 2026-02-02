import { DailyChallenge } from '@/components/home/DailyChallenge'
import { DraftArena } from '@/components/home/DraftArena'
import { TrendingInsights } from '@/components/home/TrendingInsights'
import { QuickStats } from '@/components/home/QuickStats'

export default function HomePage() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Hero Section */}
      <section className="mb-8">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-2">
          Welcome to <span className="text-gradient">GARU</span>
        </h1>
        <p className="text-muted text-lg">
          Your NBA Knowledge Arena
        </p>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Daily Challenge */}
        <div className="lg:col-span-2 space-y-6">
          <DailyChallenge />
          <DraftArena />
        </div>

        {/* Right Column - Stats & Insights */}
        <div className="space-y-6">
          <QuickStats />
          <TrendingInsights />
        </div>
      </div>
    </div>
  )
}
