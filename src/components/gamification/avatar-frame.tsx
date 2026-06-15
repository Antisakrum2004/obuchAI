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

// ★ Tier ring style — subtle border only, no glow/shadow
const tierRingStyle: Record<FrameTier, string> = {
  bronze: "ring-1 ring-orange-600/30",
  silver: "ring-1 ring-gray-300/30",
  gold: "ring-1 ring-amber-400/30",
  emerald: "ring-1 ring-emerald-400/30",
  platinum: "ring-1 ring-purple-400/30",
  rainbow: "ring-1 ring-pink-400/30",
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
          className="rounded-full border-2 border-white/10"
          style={{ width: px, height: px }}
        >
          <AvatarImage key={image || "fallback"} src={image || undefined} alt={name || ""} />
          <AvatarFallback className={cn("bg-gray-500/20 text-gray-400", textSize)}>
            {initial}
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  // ★ ADMIN — same rounded-full, no dragon frame overlay, just admin-specific ring
  if (isAdmin) {
    return (
      <div
        className={cn("relative inline-flex items-center justify-center", className)}
        style={{ width: px, height: px }}
      >
        <Avatar
          className="relative z-[2] rounded-full ring-2 ring-cyan-400/40"
          style={{ width: px, height: px }}
        >
          <AvatarImage
            key={image || "fallback"}
            src={image || undefined}
            alt={name || "Admin"}
          />
          <AvatarFallback className={cn("bg-gray-900 text-cyan-400 font-bold", textSize)}>
            {initial}
          </AvatarFallback>
        </Avatar>

        {/* Level badge */}
        <span
          className={cn(
            "absolute z-[4] flex items-center justify-center rounded-full font-bold text-white border border-white/30",
            badgeText
          )}
          style={{
            width: badgeSize,
            height: badgeSize,
            bottom: 0,
            right: 0,
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

  // ★★★ TIERED USER FRAMES — subtle ring, no glow ★★★
  const ring = tierRingStyle[tier];

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: px, height: px }}
    >
      <Avatar
        className={cn("relative z-[2] rounded-full", ring)}
        style={{ width: px, height: px }}
      >
        <AvatarImage key={image || "fallback"} src={image || undefined} alt={name || ""} />
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
