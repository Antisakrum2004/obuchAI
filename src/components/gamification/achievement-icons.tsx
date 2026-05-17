"use client";

import { cn } from "@/lib/utils";

// ★ Achievement Icon Names
export type AchievementIconName =
  | "CardReturn"
  | "Flame"
  | "FireArrow"
  | "SwordStrike"
  | "IceCard"
  | "GrabCard"
  | "Mystery"
  | "Silenced"
  | "Rush"
  | "Strength"
  | "Launch"
  | "Shield"
  | "Repaint"
  | "Recycle"
  | "Reward"
  | "CheckPlus"
  | "OneLife"
  | "TwoMult"
  | "MinusOne"
  | "PlusOne";

interface IconProps {
  className?: string;
  color?: string;
}

// ────────────────────────────────────────────────
// 1. CardReturn — two overlapping cards + curved arrow
// ────────────────────────────────────────────────
function CardReturnIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <rect x="14" y="36" width="44" height="56" rx="5" transform="rotate(-10 36 64)" />
      <rect x="26" y="18" width="44" height="56" rx="5" transform="rotate(8 48 46)" opacity=".85" />
      <path fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" d="M66 24 Q86 10 84 34 Q82 50 64 52" />
      <polygon points="58,46 70,56 72,42" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 2. Flame — large flame silhouette
// ────────────────────────────────────────────────
function FlameIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path d="M50 4 C50 4 74 20 70 46 C67 30 56 34 56 34 C64 18 44 4 44 4 C44 4 22 24 26 52 C28 64 38 76 50 82 C62 76 72 64 74 52 C78 26 62 10 50 4Z" />
      <path d="M36 20 C30 32 30 46 36 54 C30 44 26 32 30 22Z" opacity=".55" />
      <path d="M64 14 C70 24 70 38 64 46 C70 36 74 22 68 14Z" opacity=".45" />
      <path d="M50 54 C50 54 60 64 58 74 C56 82 50 86 50 86 C50 86 42 80 42 70 C40 60 50 54 50 54Z" opacity=".6" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 3. FireArrow — flame + arrow going right
// ────────────────────────────────────────────────
function FireArrowIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path d="M30 6 C30 6 50 18 48 40 C46 28 38 30 38 30 C44 18 28 6 28 6 C28 6 12 22 16 44 C18 56 28 64 32 70" />
      <path d="M20 20 C14 32 14 46 20 52 C14 40 12 28 18 22Z" opacity=".5" />
      <rect x="34" y="66" width="58" height="10" rx="3" />
      <polygon points="92,60 104,71 92,82" />
      <path fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" d="M34 66 L22 56 M34 76 L22 86" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 4. SwordStrike — sword through card
// ────────────────────────────────────────────────
function SwordStrikeIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path d="M6 28 Q4 22 10 20 L44 16 Q50 15 52 21 L58 74 Q60 80 54 82 L20 86 Q14 87 12 81 Z" />
      <path fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" d="M24 36 L30 50 L25 50 L32 66" />
      <path fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" d="M28 8 L82 90" />
      <rect x="50" y="42" width="26" height="7" rx="2.5" transform="rotate(56,63,45.5)" />
      <circle cx="80" cy="88" r="5.5" />
      <polygon points="26,6 32,12 24,18" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 5. IceCard — card + snowflake + ice crystals
// ────────────────────────────────────────────────
function IceCardIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path d="M6 24 Q4 18 10 16 L50 12 Q56 11 58 17 L68 76 Q70 82 64 84 L24 90 Q18 91 16 85 Z" />
      <path fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" d="M36 44 L36 62 M28 48 L44 58 M28 58 L44 48" />
      <circle cx="36" cy="43" r="3.5" />
      <circle cx="36" cy="63" r="3.5" />
      <circle cx="26.5" cy="47" r="3.5" />
      <circle cx="45.5" cy="59" r="3.5" />
      <circle cx="26.5" cy="59" r="3.5" />
      <circle cx="45.5" cy="47" r="3.5" />
      <polygon points="60,12 70,4 68,16" />
      <polygon points="68,18 80,12 76,28" />
      <circle cx="78" cy="8" r="4" />
      <circle cx="86" cy="20" r="3" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 6. GrabCard — hand grabbing card
// ────────────────────────────────────────────────
function GrabCardIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <rect x="46" y="6" width="38" height="50" rx="4" transform="rotate(18 65 31)" opacity=".9" />
      <path d="M8 100 L8 68 Q8 56 18 52 L30 48 Q38 46 40 54 L42 62 Q46 54 54 58 Q62 62 60 72 L50 90 Q44 100 34 100 Z" />
      <path d="M40 54 Q50 44 56 50 Q62 56 54 64" />
      <path d="M22 48 Q18 40 24 36 Q28 32 34 36" opacity=".6" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 7. Mystery — silhouette with ?
// ────────────────────────────────────────────────
function MysteryIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <circle cx="50" cy="22" r="18" />
      <path d="M16 98 Q14 72 50 66 Q86 72 84 98Z" />
      <path fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round" d="M42 76 Q42 68 50 66 Q58 68 58 76 Q58 84 50 86" />
      <circle cx="50" cy="92" r="4" />
      <path fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" d="M20 78 Q12 72 12 82 M80 78 Q88 72 88 82" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 8. Silenced — face with X mouth
// ────────────────────────────────────────────────
function SilencedIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <ellipse cx="50" cy="32" rx="24" ry="28" />
      <path d="M32 56 Q24 60 20 72 L80 72 Q76 60 68 56" />
      <path fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" d="M34 44 L66 58 M66 44 L34 58" />
      <ellipse cx="38" cy="28" rx="5" ry="3" opacity=".5" />
      <ellipse cx="62" cy="28" rx="5" ry="3" opacity=".5" />
      <path fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".4" d="M36 18 Q44 14 50 16 Q56 14 64 18" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 9. Rush — runner with shield
// ────────────────────────────────────────────────
function RushIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <circle cx="66" cy="14" r="10" />
      <path fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" d="M62 24 L50 48 L60 60 L50 84" />
      <path fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" d="M58 34 L38 26 M56 44 L74 38" />
      <path fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" d="M50 84 L38 98 M50 84 L64 96" />
      <path d="M4 22 L20 18 L20 38 C20 52 12 56 12 56 C12 56 4 52 4 38Z" />
      <path fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity=".6" d="M0 30 L10 30 M0 40 L6 40 M0 50 L8 46" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 10. Strength — flexed arm + star
// ────────────────────────────────────────────────
function StrengthIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path d="M12 74 Q8 58 14 44 Q22 30 36 30 Q50 30 54 22 Q58 14 68 14 Q78 14 80 24 Q82 34 72 38 Q64 42 60 52 Q56 64 60 76 Q64 86 56 92 Q46 98 38 92 Q26 86 22 76 Q18 68 12 74Z" />
      <polygon points="84,6 88,16 98,16 90,23 93,34 84,27 75,34 78,23 70,16 80,16" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 11. Launch — rocket with flame exhaust
// ────────────────────────────────────────────────
function LaunchIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path d="M50 4 C50 4 72 18 72 44 L72 74 L50 84 L28 74 L28 44 C28 18 50 4 50 4Z" />
      <circle cx="50" cy="36" r="10" opacity=".38" />
      <path d="M28 60 L10 80 L24 84 L28 76Z" />
      <path d="M72 60 L90 80 L76 84 L72 76Z" />
      <path d="M34 80 L30 94 L38 88 L36 100 L44 90 L50 100 L56 90 L64 100 L62 88 L70 94 L66 80" opacity=".55" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 12. Shield — heraldic shield with scratches
// ────────────────────────────────────────────────
function ShieldIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path d="M50 6 L88 20 L88 48 C88 74 50 96 50 96 C50 96 12 74 12 48 L12 20 Z" />
      <path d="M50 16 L80 28 L80 48 C80 68 50 86 50 86 C50 86 20 68 20 48 L20 28 Z" opacity=".3" />
      <path fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity=".45" d="M30 36 L42 26 M34 52 L48 38 M40 66 L56 50" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 13. Repaint — circular arrow + paint brush
// ────────────────────────────────────────────────
function RepaintIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray="11 7" d="M50 10 A40 40 0 1 1 12 60" />
      <polygon points="6,52 4,72 22,64" />
      <rect x="45" y="22" width="12" height="24" rx="4" />
      <rect x="43" y="44" width="16" height="7" rx="2" />
      <rect x="45" y="51" width="12" height="16" rx="2" />
      <path d="M44 67 L50 82 L56 67Z" />
      <rect x="47" y="8" width="8" height="16" rx="3" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 14. Recycle — spinning rings
// ────────────────────────────────────────────────
function RecycleIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" d="M50 6 A44 44 0 1 1 6 50" />
      <polygon points="2,42 6,60 20,50" />
      <path fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray="8 6" d="M50 18 A32 32 0 1 1 18 50" />
      <path fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" d="M50 30 A20 20 0 1 1 30 50" />
      <circle cx="50" cy="50" r="7" />
      <path fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity=".4" d="M50 30 Q64 30 68 44 Q72 58 64 68 Q56 78 42 72" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 15. Reward — gift box with bow
// ────────────────────────────────────────────────
function RewardIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <rect x="8" y="50" width="84" height="46" rx="3" />
      <rect x="4" y="34" width="92" height="18" rx="3" />
      <rect x="42" y="34" width="16" height="62" />
      <rect x="4" y="40" width="92" height="10" opacity=".45" />
      <path d="M50 34 Q34 24 28 12 Q24 4 36 4 Q46 4 50 18Z" />
      <path d="M50 34 Q66 24 72 12 Q76 4 64 4 Q54 4 50 18Z" />
      <circle cx="50" cy="34" r="6" />
      <path fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" d="M78 12 L80 6 L82 12 M78 12 L72 14 L78 16" />
      <path fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" d="M90 22 L92 17 L94 22 M90 22 L85 24 L90 26" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 16. CheckPlus — check +1 badge
// ────────────────────────────────────────────────
function CheckPlusIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" d="M12 52 L30 70 L62 34" />
      <text x="56" y="80" fontSize="26" fontWeight="900" fontFamily="Arial Black,Arial,sans-serif" fill={color}>+1</text>
    </svg>
  );
}

// ────────────────────────────────────────────────
// 17. OneLife — heart badge in jagged hex
// ────────────────────────────────────────────────
function OneLifeIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path fill="none" stroke={color} strokeWidth="2" d="M50 94 L34 86 L18 90 L14 74 L2 64 L8 48 L2 32 L16 26 L20 10 L36 14 L50 4 L64 14 L80 10 L84 26 L98 32 L92 48 L98 64 L86 74 L82 90 L66 86 Z" />
      <path d="M50 76 C50 76 18 56 18 36 C18 20 30 14 42 20 C46 22 48 26 50 30 C52 26 54 22 58 20 C70 14 82 20 82 36 C82 56 50 76 50 76Z" />
      <path fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".55" d="M8 54 Q2 46 4 36 Q10 28 18 34" />
      <path fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".55" d="M92 54 Q98 46 96 36 Q90 28 82 34" />
    </svg>
  );
}

// ────────────────────────────────────────────────
// 18. TwoMult — 2x badge
// ────────────────────────────────────────────────
function TwoMultIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path fill="none" stroke={color} strokeWidth="4.5" d="M50 4 C64 2 82 10 90 24 C98 38 98 56 90 70 C82 84 68 94 52 96 C36 98 20 90 12 76 C4 62 4 44 12 30 C20 16 36 6 50 4Z" />
      <path d="M50 12 C60 10 74 18 80 30 C86 42 84 58 76 68 C68 78 56 86 44 84 C32 82 22 72 18 60 C14 48 18 32 26 22 C34 12 42 14 50 12Z" opacity=".1" />
      <text x="50" y="65" textAnchor="middle" fontSize="38" fontWeight="900" fontFamily="Arial Black,Arial,sans-serif" fill={color}>2x</text>
    </svg>
  );
}

// ────────────────────────────────────────────────
// 19. MinusOne — -1 penalty badge
// ────────────────────────────────────────────────
function MinusOneIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path fill="none" stroke={color} strokeWidth="4.5" d="M50 4 C64 2 82 10 90 24 C98 38 98 56 90 70 C82 84 68 94 52 96 C36 98 20 90 12 76 C4 62 4 44 12 30 C20 16 36 6 50 4Z" />
      <path d="M50 12 C60 10 74 18 80 30 C86 42 84 58 76 68 C68 78 56 86 44 84 C32 82 22 72 18 60 C14 48 18 32 26 22 C34 12 42 14 50 12Z" opacity=".1" />
      <text x="50" y="65" textAnchor="middle" fontSize="38" fontWeight="900" fontFamily="Arial Black,Arial,sans-serif" fill={color}>-1</text>
    </svg>
  );
}

// ────────────────────────────────────────────────
// 20. PlusOne — +1 bonus badge
// ────────────────────────────────────────────────
function PlusOneIcon({ className, color = "currentColor" }: IconProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={color}>
      <path fill="none" stroke={color} strokeWidth="4.5" d="M50 4 C64 2 82 10 90 24 C98 38 98 56 90 70 C82 84 68 94 52 96 C36 98 20 90 12 76 C4 62 4 44 12 30 C20 16 36 6 50 4Z" />
      <path d="M50 12 C60 10 74 18 80 30 C86 42 84 58 76 68 C68 78 56 86 44 84 C32 82 22 72 18 60 C14 48 18 32 26 22 C34 12 42 14 50 12Z" opacity=".1" />
      <text x="50" y="65" textAnchor="middle" fontSize="38" fontWeight="900" fontFamily="Arial Black,Arial,sans-serif" fill={color}>+1</text>
    </svg>
  );
}

// ────────────────────────────────────────────────
// Icon registry
// ────────────────────────────────────────────────
export const ACHIEVEMENT_ICONS: Record<AchievementIconName, React.ComponentType<IconProps>> = {
  CardReturn: CardReturnIcon,
  Flame: FlameIcon,
  FireArrow: FireArrowIcon,
  SwordStrike: SwordStrikeIcon,
  IceCard: IceCardIcon,
  GrabCard: GrabCardIcon,
  Mystery: MysteryIcon,
  Silenced: SilencedIcon,
  Rush: RushIcon,
  Strength: StrengthIcon,
  Launch: LaunchIcon,
  Shield: ShieldIcon,
  Repaint: RepaintIcon,
  Recycle: RecycleIcon,
  Reward: RewardIcon,
  CheckPlus: CheckPlusIcon,
  OneLife: OneLifeIcon,
  TwoMult: TwoMultIcon,
  MinusOne: MinusOneIcon,
  PlusOne: PlusOneIcon,
};

// ────────────────────────────────────────────────
// Helper component
// ────────────────────────────────────────────────
interface AchievementIconProps {
  name: AchievementIconName;
  className?: string;
  color?: string;
}

export function AchievementIcon({ name, className, color }: AchievementIconProps) {
  const IconComponent = ACHIEVEMENT_ICONS[name];
  if (!IconComponent) return null;
  return <IconComponent className={className} color={color} />;
}
