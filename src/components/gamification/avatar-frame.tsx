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

// Frame PNG path per tier
const tierFrameImage: Record<FrameTier, string> = {
  bronze: "/frames/frame-bronze.png",
  silver: "/frames/frame-silver.png",
  gold: "/frames/frame-gold.png",
  emerald: "/frames/frame-emerald.png",
  platinum: "/frames/frame-platinum.png",
  rainbow: "/frames/frame-rainbow.png",
};

// Border ring style per tier (CSS ring around avatar, visible when PNG fails)
const tierRingStyle: Record<FrameTier, string> = {
  bronze: "ring-2 ring-orange-600/60",
  silver: "ring-2 ring-gray-300/60",
  gold: "ring-2 ring-amber-400/70",
  emerald: "ring-2 ring-emerald-400/70",
  platinum: "ring-2 ring-purple-400/70",
  rainbow: "ring-2 ring-pink-400/60",
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

  // ★★★ ADMIN DRAGON FRAME ★★★
  // Dragon frame PNG overlay sits right on the avatar contour
  if (isAdmin) {
    // Frame ring thickness: ~12% of avatar size on each side
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

        {/* Avatar image centered */}
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

        {/* Dragon frame PNG overlay — same size as container, object-contain */}
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

  // ★★★ TIERED USER FRAMES ★★★
  // Frame PNG overlay sits right on the avatar contour — tight ring
  const frameThickness = Math.round(px * 0.10);
  const containerSize = px + frameThickness * 2;
  const badgeOffset = Math.round(frameThickness * 0.2);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: containerSize, height: containerSize }}
    >
      {/* Tier glow */}
      <div
        className={cn("absolute rounded-full z-[1]", `avatar-tier-glow-${tier}`)}
        style={{ width: "90%", height: "90%" }}
      />

      {/* Avatar image centered */}
      <Avatar
        className={cn("relative z-[2] rounded-full", tierRingStyle[tier])}
        style={{ width: px, height: px }}
      >
        <AvatarImage src={image || undefined} alt={name || ""} />
        <AvatarFallback className={cn(tierFallbackBg[tier], textSize)}>
          {initial}
        </AvatarFallback>
      </Avatar>

      {/* Frame PNG overlay — same size as container, follows avatar contour */}
      <img
        src={tierFrameImage[tier]}
        alt=""
        className={cn("absolute inset-0 w-full h-full object-contain z-[3] pointer-events-none", `avatar-tier-frame-${tier}`)}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
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
          bottom: badgeOffset,
          right: badgeOffset,
          fontSize: size === "sm" ? 7 : size === "md" ? 9 : 12,
          lineHeight: 1,
        }}
      >
        {level}
      </span>
    </div>
  );
}
