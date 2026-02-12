"use client"

import { Home, PieChart, Activity, User } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { icon: Home, label: "Início", active: true },
  { icon: PieChart, label: "Portfólio", active: false },
  { icon: Activity, label: "Mercado", active: false },
  { icon: User, label: "Perfil", active: false },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
      <div className="flex items-center justify-around px-4 py-2 max-w-7xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors",
                item.active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
