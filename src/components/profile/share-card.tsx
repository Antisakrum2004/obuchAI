"use client";

import { useRef, useState, useCallback, forwardRef } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Share2, Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface ShareCardProps {
  profile: {
    name: string;
    image: string | null;
    level: number;
    xp: number;
    streak: number;
    maxStreak: number;
    rank: number;
    achievements: { name: string; icon: string; category: string }[];
    stats: {
      completedChallenges: number;
      totalAttempts: number;
      accuracy: number;
    };
  };
}

function getLevelTier(level: number) {
  if (level >= 31)
    return {
      name: "Алмаз",
      color: "#22d3ee",
      bg: "rgba(34,211,238,0.15)",
      border: "rgba(34,211,238,0.4)",
      glow: "0 0 15px rgba(34,211,238,0.3)",
    };
  if (level >= 16)
    return {
      name: "Золото",
      color: "#fbbf24",
      bg: "rgba(251,191,36,0.15)",
      border: "rgba(251,191,36,0.4)",
      glow: "0 0 15px rgba(251,191,36,0.3)",
    };
  if (level >= 6)
    return {
      name: "Серебро",
      color: "#cbd5e1",
      bg: "rgba(203,213,225,0.15)",
      border: "rgba(203,213,225,0.3)",
      glow: "0 0 15px rgba(203,213,225,0.2)",
    };
  return {
    name: "Бронза",
    color: "#fb923c",
    bg: "rgba(251,146,60,0.15)",
    border: "rgba(251,146,60,0.3)",
    glow: "",
  };
}

/* ── The visual card rendered in a hidden container for PNG capture ── */
const ShareCardVisual = forwardRef<HTMLDivElement, ShareCardProps>(
  function ShareCardVisualImpl({ profile }, ref) {
    const tier = getLevelTier(profile.level);
    const topAchievements = profile.achievements.slice(0, 4);

    return (
      <div ref={ref}>
        <div
          style={{
            width: 400,
            minHeight: 500,
            background:
              "linear-gradient(160deg, #0d0d1a 0%, #111128 50%, #0a0a1a 100%)",
            borderRadius: 20,
            padding: 3,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Inner card with gradient border effect */}
          <div
            style={{
              borderRadius: 18,
              background:
                "linear-gradient(160deg, #0d0d1a 0%, #111128 50%, #0a0a1a 100%)",
              padding: 24,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Glow accent top-right */}
            <div
              style={{
                position: "absolute",
                top: -60,
                right: -60,
                width: 200,
                height: 200,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
            {/* Glow accent bottom-left */}
            <div
              style={{
                position: "absolute",
                bottom: -80,
                left: -80,
                width: 220,
                height: 220,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            {/* Header: Logo + App name */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 20,
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "rgba(16,185,129,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                ⚡
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #10b981, #8b5cf6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: 0.5,
                }}
              >
                AI Тренажёр
              </span>
            </div>

            {/* Avatar + Name + Level */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: 20,
                position: "relative",
              }}
            >
              {/* Avatar with gradient ring */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  padding: 3,
                  background: "linear-gradient(135deg, #10b981, #8b5cf6)",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: "#111128",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {profile.image ? (
                    <img
                      src={profile.image}
                      alt={profile.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "50%",
                      }}
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: "#10b981",
                      }}
                    >
                      {profile.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Name */}
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#f1f5f9",
                  textAlign: "center",
                  marginBottom: 6,
                }}
              >
                {profile.name}
              </div>

              {/* Level badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: tier.bg,
                  border: `1px solid ${tier.border}`,
                  boxShadow: tier.glow,
                }}
              >
                <span
                  style={{ fontSize: 12, color: tier.color, fontWeight: 700 }}
                >
                  Ур. {profile.level}
                </span>
                <span
                  style={{
                    width: 1,
                    height: 12,
                    background: tier.border,
                  }}
                />
                <span style={{ fontSize: 11, color: tier.color }}>
                  {tier.name}
                </span>
              </div>
            </div>

            {/* Main stats row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginBottom: 16,
                position: "relative",
              }}
            >
              {[
                {
                  label: "XP",
                  value: profile.xp.toLocaleString(),
                  color: "#fbbf24",
                },
                {
                  label: "Серия",
                  value: `${profile.streak}🔥`,
                  color: "#fb923c",
                },
                {
                  label: "Рейтинг",
                  value: `#${profile.rank}`,
                  color: "#a78bfa",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    textAlign: "center",
                    padding: "10px 4px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: stat.color,
                      marginBottom: 2,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Challenge stats row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginBottom: 16,
                position: "relative",
              }}
            >
              {[
                {
                  label: "Решено",
                  value: String(profile.stats.completedChallenges),
                  color: "#10b981",
                },
                {
                  label: "Попыток",
                  value: String(profile.stats.totalAttempts),
                  color: "#38bdf8",
                },
                {
                  label: "Точность",
                  value: `${profile.stats.accuracy}%`,
                  color: "#f472b6",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    textAlign: "center",
                    padding: "8px 4px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: stat.color,
                      marginBottom: 2,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 9, color: "#64748b" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Achievements */}
            {topAchievements.length > 0 && (
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    fontSize: 10,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  Достижения
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                  }}
                >
                  {topAchievements.map((a, i) => (
                    <div
                      key={i}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: "rgba(139,92,246,0.12)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                      }}
                      title={a.name}
                    >
                      {a.icon}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer branding */}
            <div
              style={{
                marginTop: 20,
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                textAlign: "center",
                position: "relative",
              }}
            >
              <span style={{ fontSize: 10, color: "#475569" }}>
                ai-trainer.dev
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

/* ── Main component with button + dialog ── */
export function ShareCardButton({ profile }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const generateImage = useCallback(async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        cacheBust: true,
      });
      setImageUrl(dataUrl);
      setOpen(true);
    } catch (err) {
      console.error("Image generation failed:", err);
      toast.error("Не удалось сгенерировать изображение");
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.download = `profile-${profile.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = imageUrl;
    link.click();
    toast.success("Изображение скачано!");
  }, [imageUrl, profile.name]);

  const handleShare = useCallback(async () => {
    if (!imageUrl) return;

    try {
      const blob = await fetch(imageUrl).then((r) => r.blob());
      const file = new File([blob], "profile.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Профиль ${profile.name} — AI Тренажёр`,
          text: `Уровень ${profile.level} • ${profile.xp} XP • Рейтинг #${profile.rank}`,
          files: [file],
        });
      } else {
        handleDownload();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        handleDownload();
      }
    }
  }, [imageUrl, profile, handleDownload]);

  return (
    <>
      {/* Hidden card for rendering to PNG */}
      <div
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          zIndex: -1,
          pointerEvents: "none",
        }}
      >
        <ShareCardVisual ref={cardRef} profile={profile} />
      </div>

      {/* Trigger button */}
      <Button
        onClick={generateImage}
        disabled={generating}
        className="gap-2 bg-gradient-to-r from-emerald-500 to-purple-500 hover:from-emerald-400 hover:to-purple-400 text-white font-semibold"
        size="lg"
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        Поделиться
      </Button>

      {/* Preview dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-[#0d0d1a] border-white/10">
          <DialogTitle className="text-center text-lg font-semibold gradient-text">
            Поделиться профилем
          </DialogTitle>

          {imageUrl && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <img
                  src={imageUrl}
                  alt="Карточка профиля"
                  className="w-full max-w-[400px]"
                />
              </div>

              <div className="flex gap-3 w-full">
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="flex-1 gap-2 border-white/10 bg-white/5 hover:bg-white/10"
                >
                  <Download className="h-4 w-4" />
                  Скачать
                </Button>
                <Button
                  onClick={handleShare}
                  className="flex-1 gap-2 bg-gradient-to-r from-emerald-500 to-purple-500 hover:from-emerald-400 hover:to-purple-400 text-white"
                >
                  <Share2 className="h-4 w-4" />
                  Поделиться
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
