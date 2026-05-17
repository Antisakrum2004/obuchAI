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
  sm: 16,
  md: 20,
  lg: 28,
} as const;

const levelBadgeTextMap = {
  sm: "text-[8px]",
  md: "text-[10px]",
  lg: "text-xs",
} as const;

function getTier(level: number): "basic" | "silver" | "gold" | "platinum" | "rainbow" {
  if (level <= 5) return "basic";
  if (level <= 10) return "silver";
  if (level <= 20) return "gold";
  if (level <= 30) return "platinum";
  return "rainbow";
}

const tierFallbackBg: Record<string, string> = {
  basic: "bg-gray-500/20 text-gray-400",
  silver: "bg-gray-400/20 text-gray-300",
  gold: "bg-amber-500/20 text-amber-400",
  platinum: "bg-purple-500/20 text-purple-300",
  rainbow: "bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-emerald-500/20 text-pink-300",
};

const tierBorderClass: Record<string, string> = {
  basic: "border-2 border-gray-500/40",
  silver: "avatar-frame-silver",
  gold: "avatar-frame-gold",
  platinum: "avatar-frame-platinum",
  rainbow: "avatar-frame-rainbow",
};

const tierLevelBadgeBg: Record<string, string> = {
  basic: "bg-gray-500",
  silver: "bg-gray-400",
  gold: "bg-amber-500",
  platinum: "bg-purple-500",
  rainbow: "bg-gradient-to-br from-pink-500 via-purple-500 to-emerald-500",
};

export function AvatarFrame({ level, image, name, size = "md", role, className }: AvatarFrameProps) {
  const { avatarFrames } = useAppSettings();
  const tier = getTier(level);
  const px = sizeMap[size];
  const textSize = sizeTextMap[size];
  const initial = name?.charAt(0)?.toUpperCase() || "U";
  const isComplexFrame = avatarFrames && (tier === "platinum" || tier === "rainbow");
  const isAdmin = role === "admin";

  // Level badge rendering
  const badgeSize = levelBadgeSizeMap[size];
  const badgeText = levelBadgeTextMap[size];
  const levelBadge = (
    <span
      className={cn(
        "absolute z-10 flex items-center justify-center rounded-full font-bold text-white border border-white/30",
        badgeText,
        tierLevelBadgeBg[tier]
      )}
      style={{
        width: badgeSize,
        height: badgeSize,
        bottom: -1,
        right: -1,
        fontSize: size === "sm" ? 8 : size === "md" ? 9 : 12,
        lineHeight: 1,
      }}
    >
      {level}
    </span>
  );

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
        {levelBadge}
      </div>
    );
  }

  // ★ Admin dragon frame — WoW rare card style with dragon-frame.png overlay
  if (isAdmin) {
    // Dragon frame needs more space — the frame image is 100% of the container
    // Avatar sits at 72% inside, centered
    const containerSize = Math.round(px * 1.4); // Frame is bigger than avatar
    const avatarSize = Math.round(containerSize * 0.68);

    return (
      <div
        className={cn("admin-avatar relative inline-flex items-center justify-center", className)}
        style={{ width: containerSize, height: containerSize }}
      >
        {/* Glow layer */}
        <div
          className="admin-avatar__glow absolute rounded-full"
          style={{
            width: "78%",
            height: "78%",
          }}
        />
        {/* Avatar image */}
        <Avatar
          className="admin-avatar__image relative z-[2] border-[3px] border-white/12"
          style={{ width: avatarSize, height: avatarSize }}
        >
          <AvatarImage src={image || undefined} alt={name || ""} />
          <AvatarFallback className={cn(tierFallbackBg[tier], textSize)}>
            {initial}
          </AvatarFallback>
        </Avatar>
        {/* Dragon frame overlay */}
        <img
          src="/frames/dragon-frame.png"
          alt=""
          className="admin-avatar__frame absolute inset-0 w-full h-full object-contain z-[3] pointer-events-none"
        />
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
            bottom: Math.round(containerSize * 0.05),
            right: Math.round(containerSize * 0.05),
            fontSize: size === "sm" ? 8 : size === "md" ? 9 : 12,
            lineHeight: 1,
          }}
        >
          {level}
        </span>
      </div>
    );
  }

  // For platinum and rainbow, we use a wrapper with padding for the conic gradient border
  if (isComplexFrame) {
    return (
      <div
        className={cn(
          "relative inline-block rounded-full",
          tierBorderClass[tier],
          className
        )}
        style={{ width: px + 8, height: px + 8 }}
      >
        <Avatar
          className="rounded-full"
          style={{ width: px, height: px }}
        >
          <AvatarImage src={image || undefined} alt={name || ""} />
          <AvatarFallback className={cn(tierFallbackBg[tier], textSize)}>
            {initial}
          </AvatarFallback>
        </Avatar>
        {levelBadge}
      </div>
    );
  }

  return (
    <div className={cn("relative inline-block", className)} style={{ width: px, height: px }}>
      <Avatar
        className={cn(tierBorderClass[tier])}
        style={{ width: px, height: px }}
      >
        <AvatarImage src={image || undefined} alt={name || ""} />
        <AvatarFallback className={cn(tierFallbackBg[tier], textSize)}>
          {initial}
        </AvatarFallback>
      </Avatar>
      {levelBadge}
    </div>
  );
}
