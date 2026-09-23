import {
  Braces, Bug, Clock3, Code2, CreditCard, Database, FileCheck2, FileText, GitCompare, Globe2, Image,
  KeyRound, List, Lock, Mail, Search, Settings2, ShieldCheck, Terminal, Type, type LucideIcon
} from "lucide-react";
import type { UseCaseIcon as UseCaseIconName } from "@/lib/tool-guide";

const ICONS: Record<UseCaseIconName, { icon: LucideIcon; tone: string }> = {
  api: { icon: Braces, tone: "green" },
  file: { icon: FileCheck2, tone: "purple" },
  data: { icon: Database, tone: "amber" },
  code: { icon: Code2, tone: "blue" },
  bug: { icon: Bug, tone: "red" },
  config: { icon: Settings2, tone: "amber" },
  search: { icon: Search, tone: "blue" },
  shield: { icon: ShieldCheck, tone: "green" },
  key: { icon: KeyRound, tone: "amber" },
  card: { icon: CreditCard, tone: "red" },
  clock: { icon: Clock3, tone: "amber" },
  globe: { icon: Globe2, tone: "cyan" },
  text: { icon: Type, tone: "purple" },
  compare: { icon: GitCompare, tone: "purple" },
  terminal: { icon: Terminal, tone: "blue" },
  image: { icon: Image, tone: "red" },
  list: { icon: List, tone: "cyan" },
  mail: { icon: Mail, tone: "blue" },
  lock: { icon: Lock, tone: "blue" },
  doc: { icon: FileText, tone: "purple" }
};

export function UseCaseIcon({ name }: { name: UseCaseIconName }) {
  const { icon: Icon, tone } = ICONS[name];
  return <Icon size={18} className={`usecase-icon tone-${tone}`} aria-hidden />;
}
