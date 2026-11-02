import {
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  FlaskConical,
  Folder,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Leaf,
  type LucideIcon,
  Scale,
  Search,
  Settings,
  Target,
  Users,
} from "lucide-react";
import type { IconName } from "@/lib/modules/registry";

// Icon set for the sidebar/app (SLD_RESTRUCTURE_PLAN_platform-modules.md §5.2).
// lucide-react (founder-approved on the P2 review) — one consistent,
// tree-shakeable line set. Maps the registry's IconName union to a lucide
// component; currentColor stroke so icons inherit their container's text
// colour.
const ICONS: Record<IconName, LucideIcon> = {
  cockpit: LayoutDashboard,
  inbox: Inbox,
  "clipboard-check": ClipboardCheck,
  search: Search,
  "alert-triangle": AlertTriangle,
  leaf: Leaf,
  target: Target,
  flask: FlaskConical,
  "graduation-cap": GraduationCap,
  users: Users,
  scale: Scale,
  folder: Folder,
  "bar-chart": BarChart3,
  settings: Settings,
};

export function Icon({
  name,
  className,
  size = 20,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  const Cmp = ICONS[name];
  return <Cmp size={size} className={className} aria-hidden="true" />;
}
