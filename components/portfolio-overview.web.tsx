"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"

export function PortfolioOverview() {
  const { t } = useLanguage()
  const totalValue = 142580.42
  const change24h = 3.84
  const changeValue = 5280.12
  const isPositive = change24h > 0

  return (
    <Card className="p-6 bg-card">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground font-medium">Total</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h2 className="text-4xl font-bold text-foreground font-mono tracking-tight">
              ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium",
              isPositive ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
            )}
          >
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span className="font-mono">
              {Math.abs(change24h).toFixed(2)}%
            </span>
          </div>
          <span className={cn("text-sm font-medium font-mono", isPositive ? "text-primary" : "text-destructive")}>
            ${Math.abs(changeValue).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-muted-foreground">{t('pnl.24hLabel')}</span>
        </div>
      </div>
    </Card>
  )
}
