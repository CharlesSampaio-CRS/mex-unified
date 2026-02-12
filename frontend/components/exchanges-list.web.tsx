"use client"

import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"
import { Card } from "@/components/ui/card"
import { ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

const exchanges = [
  {
    name: "Binance",
    logo: "🔶",
    balance: 68420.5,
    change: 2.4,
    assets: 12,
  },
  {
    name: "Coinbase",
    logo: "🔵",
    balance: 42180.22,
    change: 5.8,
    assets: 8,
  },
  {
    name: "Kraken",
    logo: "🟣",
    balance: 31979.7,
    change: 3.2,
    assets: 6,
  },
]

export function ExchangesList() {
  const { t } = useLanguage()
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Exchanges</h3>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="space-y-3">
        {exchanges.map((exchange) => (
          <Card key={exchange.name} className="p-4 bg-card hover:bg-accent/50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-xl">
                  {exchange.logo}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{exchange.name}</h4>
                  <p className="text-xs text-muted-foreground">{exchange.assets} {exchange.assets === 1 ? t('exchanges.asset') : t('exchanges.assets')}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground font-mono">
                    ${exchange.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-medium font-mono",
                      exchange.change > 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {exchange.change > 0 ? "+" : ""}
                    {exchange.change}%
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
