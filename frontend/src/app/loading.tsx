import { BasketballLoader } from '@/components/ui/BasketballLoader'

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <BasketballLoader size="lg" text="Loading GARU..." />
    </div>
  )
}
