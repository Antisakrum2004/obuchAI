"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppSettings } from "@/hooks/use-app-settings";

interface AvatarFrameProps {
  level: number;
  image?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
  role?: string | null;
  className?: string;
}

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 80,
} as const;

const sizeTextMap = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-xl",
} as const;

const levelBadgeSizeMap = {
  sm: 14,
  md: 18,
  lg: 26,
} as const;

const levelBadgeTextMap = {
  sm: "text-[7px]",
  md: "text-[9px]",
  lg: "text-xs",
} as const;

// ★ Tier system
type FrameTier = "bronze" | "silver" | "gold" | "emerald" | "platinum" | "rainbow";

function getTier(level: number): FrameTier {
  if (level < 5) return "bronze";
  if (level < 10) return "silver";
  if (level < 15) return "gold";
  if (level < 25) return "emerald";
  if (level < 35) return "platinum";
  return "rainbow";
}

const tierFallbackBg: Record<FrameTier, string> = {
  bronze: "bg-orange-900/30 text-orange-300",
  silver: "bg-gray-400/20 text-gray-300",
  gold: "bg-amber-500/20 text-amber-400",
  emerald: "bg-emerald-500/20 text-emerald-300",
  platinum: "bg-purple-500/20 text-purple-300",
  rainbow: "bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-emerald-500/20 text-pink-300",
};

const tierLevelBadgeBg: Record<FrameTier, string> = {
  bronze: "bg-orange-700",
  silver: "bg-gray-400",
  gold: "bg-amber-500",
  emerald: "bg-emerald-500",
  platinum: "bg-purple-500",
  rainbow: "bg-gradient-to-br from-pink-500 via-purple-500 to-emerald-500",
};

// ★ Glow style per tier — CSS box-shadow that radiates OUTWARD only, max 15% of avatar size
// glow color + ring border color per tier
const tierGlowStyle: Record<FrameTier, { shadow: string; ring: string }> = {
  bronze: {
    shadow: "0 0 8px 2px rgba(180,120,60,0.35), 0 0 16px 4px rgba(210,160,100,0.15)",
    ring: "ring-2 ring-orange-600/50",
  },
  silver: {
    shadow: "0 0 10px 2px rgba(180,190,210,0.40), 0 0 20px 5px rgba(200,205,215,0.18)",
    ring: "ring-2 ring-gray-300/50",
  },
  gold: {
    shadow: "0 0 12px 3px rgba(234,179,8,0.45), 0 0 24px 6px rgba(245,190,50,0.20)",
    ring: "ring-2 ring-amber-400/60",
  },
  emerald: {
    shadow: "0 0 14px 3px rgba(16,185,129,0.45), 0 0 28px 7px rgba(52,211,153,0.20)",
    ring: "ring-2 ring-emerald-400/60",
  },
  platinum: {
    shadow: "0 0 16px 4px rgba(139,92,246,0.45), 0 0 32px 8px rgba(168,85,247,0.22)",
    ring: "ring-2 ring-purple-400/60",
  },
  rainbow: {
    shadow: "0 0 18px 4px rgba(236,72,153,0.40), 0 0 28px 6px rgba(139,92,246,0.25), 0 0 36px 8px rgba(16,185,129,0.18)",
    ring: "ring-2 ring-pink-400/50",
  },
};

export function AvatarFrame({ level, image, name, size = "md", role, className }: AvatarFrameProps) {
  const { avatarFrames } = useAppSettings();
  const tier = getTier(level);
  const px = sizeMap[size];
  const textSize = sizeTextMap[size];
  const initial = name?.charAt(0)?.toUpperCase() || "U";
  const isAdmin = role === "admin";

  const badgeSize = levelBadgeSizeMap[size];
  const badgeText = levelBadgeTextMap[size];

  // When avatar frames are disabled, render a simple circle
  if (!avatarFrames) {
    return (
      <div className={cn("relative inline-block", className)} style={{ width: px, height: px }}>
        <Avatar
          className="border-2 border-white/10"
          style={{ width: px, height: px }}
        >
          <AvatarImage src={image || undefined} alt={name || ""} />
          <AvatarFallback className={cn("bg-gray-500/20 text-gray-400", textSize)}>
            {initial}
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  // ★★★ ADMIN DRAGON FRAME ★★★ (kept as is)
  if (isAdmin) {
    const frameThickness = Math.round(px * 0.12);
    const containerSize = px + frameThickness * 2;
    const badgeOffset = Math.round(frameThickness * 0.3);

    return (
      <div
        className={cn("relative inline-flex items-center justify-center", className)}
        style={{ width: containerSize, height: containerSize }}
      >
        {/* Glow layer */}
        <div
          className="absolute rounded-full z-[1]"
          style={{
            width: containerSize,
            height: containerSize,
            background: "radial-gradient(circle, rgba(0,212,255,0.15) 0%, rgba(0,180,220,0.05) 50%, transparent 75%)",
            filter: "blur(6px)",
          }}
        />

        {/* Avatar image at full px size */}
        <Avatar
          className="relative z-[2] rounded-full"
          style={{ width: px, height: px }}
        >
          <AvatarImage
            src={image || "/avatars/admin-avatar.png"}
            alt={name || "Admin"}
          />
          <AvatarFallback className={cn("bg-gray-900 text-cyan-400 font-bold", textSize)}>
            👑
          </AvatarFallback>
        </Avatar>

        {/* Dragon frame PNG overlay */}
        <img
          src="/frames/dragon-frame.png"
          alt=""
          className="absolute inset-0 w-full h-full object-contain z-[3] pointer-events-none"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />

        {/* Level badge */}
        <span
          className={cn(
            "absolute z-[5] flex items-center justify-center rounded-full font-bold text-white border-2 border-cyan-400/40 shadow-[0_0_8px_rgba(0,212,255,0.5)]",
            badgeText
          )}
          style={{
            width: badgeSize + 4,
            height: badgeSize + 4,
            bottom: badgeOffset,
            right: badgeOffset,
            fontSize: size === "sm" ? 7 : size === "md" ? 9 : 12,
            lineHeight: 1,
            background: "linear-gradient(135deg, #0d9488, #0891b2)",
          }}
        >
          {level}
        </span>
      </div>
    );
  }

  // ★★★ TIERED USER FRAMES — just colored glow outward, no PNG ★★★
  // Container is slightly bigger to accommodate the glow (15% outward)
  const glowPadding = Math.round(px * 0.15);
  const containerSize = px + glowPadding * 2;
  const glow = tierGlowStyle[tier];

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: containerSize, height: containerSize }}
    >
      {/* Tier glow — radiates OUTWARD only, behind avatar */}
      <div
        className="absolute rounded-full z-[1]"
        style={{
          width: px + 4,
          height: px + 4,
          boxShadow: glow.shadow,
        }}
      />

      {/* Avatar image at FULL px size */}
      <Avatar
        className={cn("relative z-[2] rounded-full", glow.ring)}
        style={{ width: px, height: px }}
      >
        <AvatarImage src={image || undefined} alt={name || ""} />
        <AvatarFallback className={cn(tierFallbackBg[tier], textSize)}>
          {initial}
        </AvatarFallback>
      </Avatar>

      {/* Level badge */}
      <span
        className={cn(
          "absolute z-[4] flex items-center justify-center rounded-full font-bold text-white border border-white/30",
          badgeText,
          tierLevelBadgeBg[tier]
        )}
        style={{
          width: badgeSize,
          height: badgeSize,
          bottom: 0,
          right: 0,
          fontSize: size === "sm" ? 7 : size === "md" ? 9 : 12,
          lineHeight: 1,
        }}
      >
        {level}
      </span>
    </div>
  );
}
