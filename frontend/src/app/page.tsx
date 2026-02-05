import { DailyChallenge } from '@/components/home/DailyChallenge'
import { MultiplayerArena } from '@/components/home/MultiplayerArena'
import { QuickStats } from '@/components/home/QuickStats'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Video Section */}
      <section className="relative h-[40vh] md:h-[50vh] overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-deep-void/60 via-deep-void/40 to-deep-void" />
        
        {/* Hero Content */}
        <div className="relative z-10 h-full flex flex-col justify-center px-4 md:px-8 lg:px-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-3">
            Welcome to <span className="text-gradient">GARU</span>
          </h1>
          <p className="text-xl md:text-2xl text-ghost-white/90 font-medium">
            Ball Knowers Arena
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="px-4 py-6 md:px-8 lg:px-12">
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Daily Challenge */}
          <div className="lg:col-span-2 space-y-6">
            <DailyChallenge />
            <MultiplayerArena />
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-6">
            <QuickStats />
          </div>
        </div>
      </div>
    </div>
  )
}
