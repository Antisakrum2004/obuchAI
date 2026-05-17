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

// ★ Tier system: each tier unlocks a more elaborate frame
// 1+: bronze border, 5+: silver shimmer, 10+: gold glow, 15+: emerald diamond, 25+: platinum conic, 35+: rainbow
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

// ★ Level badge background color per tier
const tierLevelBadgeBg: Record<FrameTier, string> = {
  bronze: "bg-orange-700",
  silver: "bg-gray-400",
  gold: "bg-amber-500",
  emerald: "bg-emerald-500",
  platinum: "bg-purple-500",
  rainbow: "bg-gradient-to-br from-pink-500 via-purple-500 to-emerald-500",
};

// ★ Frame image path per tier (PNG overlays from /frames/)
const tierFrameImage: Record<FrameTier, string | null> = {
  bronze: "/frames/frame-bronze.png",
  silver: "/frames/frame-silver.png",
  gold: "/frames/frame-gold.png",
  emerald: "/frames/frame-emerald.png",
  platinum: "/frames/frame-platinum.png",
  rainbow: "/frames/frame-rainbow.png",
};

export function AvatarFrame({ level, image, name, size = "md", role, className }: AvatarFrameProps) {
  const { avatarFrames } = useAppSettings();
  const tier = getTier(level);
  const px = sizeMap[size];
  const textSize = sizeTextMap[size];
  const initial = name?.charAt(0)?.toUpperCase() || "U";
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

  // ★★★ ADMIN DRAGON FRAME ★★★
  // Legendary dragon frame — only the dragon PNG + glow, no extra dots
  if (isAdmin) {
    const containerSize = Math.round(px * 1.5);
    const avatarSize = Math.round(containerSize * 0.60);
    const badgeOffset = Math.round(containerSize * 0.04);

    return (
      <div
        className="admin-avatar relative inline-flex items-center justify-center"
        style={{ width: containerSize, height: containerSize }}
      >
        {/* Background glow */}
        <div className="admin-avatar__glow absolute" style={{ width: "80%", height: "80%" }} />

        {/* Animated conic gradient border ring */}
        <div className="admin-avatar__ring absolute" style={{ width: "88%", height: "88%" }} />

        {/* Avatar image — use admin avatar image if no custom one */}
        <Avatar
          className="admin-avatar__image relative z-[2]"
          style={{ width: avatarSize, height: avatarSize }}
        >
          <AvatarImage
            src={image || "/avatars/admin-avatar.png"}
            alt={name || "Admin"}
          />
          <AvatarFallback className={cn("bg-gray-900 text-cyan-400 font-bold", textSize)}>
            👑
          </AvatarFallback>
        </Avatar>

        {/* Dragon frame PNG overlay — the only decoration */}
        <img
          src="/frames/dragon-frame.png"
          alt=""
          className="admin-avatar__frame absolute inset-0 w-full h-full object-contain z-[3] pointer-events-none"
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
            fontSize: size === "sm" ? 8 : size === "md" ? 9 : 12,
            lineHeight: 1,
            background: "linear-gradient(135deg, #0d9488, #0891b2)",
          }}
        >
          {level}
        </span>
      </div>
    );
  }

  // ★★★ TIERED USER FRAMES ★★★
  // Each tier has a frame PNG overlay + CSS effects
  const frameImage = tierFrameImage[tier];
  // Container is slightly larger than avatar to accommodate the frame
  const containerSize = Math.round(px * 1.35);
  const avatarInnerSize = Math.round(containerSize * 0.66);
  const badgeOffset = Math.round(containerSize * 0.03);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: containerSize, height: containerSize }}
    >
      {/* Tier glow */}
      <div
        className={cn("absolute rounded-full z-[1]", `avatar-tier-glow-${tier}`)}
        style={{ width: "78%", height: "78%" }}
      />

      {/* Avatar image */}
      <Avatar
        className={cn("relative z-[2] rounded-full", `avatar-tier-border-${tier}`)}
        style={{ width: avatarInnerSize, height: avatarInnerSize }}
      >
        <AvatarImage src={image || undefined} alt={name || ""} />
        <AvatarFallback className={cn(tierFallbackBg[tier], textSize)}>
          {initial}
        </AvatarFallback>
      </Avatar>

      {/* Frame PNG overlay */}
      {frameImage && (
        <img
          src={frameImage}
          alt=""
          className={cn("absolute inset-0 w-full h-full object-contain z-[3] pointer-events-none", `avatar-tier-frame-${tier}`)}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}

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
          bottom: badgeOffset,
          right: badgeOffset,
          fontSize: size === "sm" ? 8 : size === "md" ? 9 : 12,
          lineHeight: 1,
        }}
      >
        {level}
      </span>
    </div>
  );
}
