import { Activity, CalendarDays, Calculator, ChartNoAxesCombined, Percent, Shield, Target, WalletCards, type LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  calendar: CalendarDays,
  calculator: Calculator,
  chart: ChartNoAxesCombined,
  percent: Percent,
  shield: Shield,
  target: Target,
  wallet: WalletCards,
}

export const TOOL_ICON_OPTIONS = Object.keys(ICONS)

export function ToolIcon({ iconKey, className = 'size-5' }: { iconKey: string | null; className?: string }) {
  const Icon = iconKey ? ICONS[iconKey] ?? Calculator : Calculator
  return <Icon className={className} aria-hidden="true" />
}
