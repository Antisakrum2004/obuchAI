"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppSettings } from "@/hooks/use-app-settings";

interface AvatarFrameProps {
  level: number;
  image?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
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

export function AvatarFrame({ level, image, name, size = "md", className }: AvatarFrameProps) {
  const { avatarFrames } = useAppSettings();
  const tier = getTier(level);
  const px = sizeMap[size];
  const textSize = sizeTextMap[size];
  const initial = name?.charAt(0)?.toUpperCase() || "U";
  const isComplexFrame = avatarFrames && (tier === "platinum" || tier === "rainbow");

  // When avatar frames are disabled, render a simple circle
  if (!avatarFrames) {
    return (
      <Avatar
        className={cn("border-2 border-white/10", className)}
        style={{ width: px, height: px }}
      >
        <AvatarImage src={image || undefined} alt={name || ""} />
        <AvatarFallback className={cn("bg-gray-500/20 text-gray-400", textSize)}>
          {initial}
        </AvatarFallback>
      </Avatar>
    );
  }

  // For platinum and rainbow, we use a wrapper with padding for the conic gradient border
  if (isComplexFrame) {
    return (
      <div
        className={cn(
          "inline-flex rounded-full",
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
      </div>
    );
  }

  return (
    <Avatar
      className={cn(tierBorderClass[tier], className)}
      style={{ width: px, height: px }}
    >
      <AvatarImage src={image || undefined} alt={name || ""} />
      <AvatarFallback className={cn(tierFallbackBg[tier], textSize)}>
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
