// Web-only imports disabled for React Native compatibility
// import { PortfolioOverview } from "@/components/portfolio-overview"
// import { ExchangesList } from "@/components/exchanges-list"
// import { QuickChart } from "@/components/quick-chart"
import { BottomNav } from "@/components/bottom-nav"
import { Header } from "@/components/Header"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col pb-20">
      <Header />

      <main className="flex-1 px-4 py-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Web-only components commented out */}
        {/* <PortfolioOverview />
        <QuickChart />
        <ExchangesList /> */}
      </main>

      <BottomNav />
    </div>
  )
}
