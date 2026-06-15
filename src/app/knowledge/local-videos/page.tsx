"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  MonitorPlay,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  AlertCircle,
  ArrowRight,
  BookOpen,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useUserStore } from "@/store/user-store";

interface VideoFile {
  name: string;
  title: string;
}

function extractTitle(filename: string): string {
  let title = filename.replace(/\.mp4$/i, "");
  title = title.replace(/[_-]+/g, " ");
  return title.trim().replace(/^\w/, (c) => c.toUpperCase());
}

export default function LocalVideosPage() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Dynamic title & description from DB
  const [sectionTitle, setSectionTitle] = useState("Платные курсы");
  const [sectionDescription, setSectionDescription] = useState(
    "Практические видеокурсы по AI-интеграции и автоматизации 1С"
  );

  // Admin inline editing state
  const [editingField, setEditingField] = useState<"title" | "description" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLInputElement>(null);

  // Admin detection
  const { role: storeRole } = useUserStore();
  const sessionResult = useSession();
  const session = sessionResult?.data ?? null;
  const sessionRole = session?.user?.role;
  const isAdmin = storeRole === "admin" || sessionRole === "admin";

  // Fetch section settings (title + description)
  useEffect(() => {
    fetch("/api/video/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.title) setSectionTitle(data.title);
        if (data.description) setSectionDescription(data.description);
      })
      .catch(() => {});
  }, []);

  // Fetch video list from media server API
  useEffect(() => {
    fetch("/api/video/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.files && Array.isArray(data.files)) {
          const videoList = data.files.map((f: string) => ({
            name: f,
            title: extractTitle(f),
          }));
          setVideos(videoList);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (editingField === "title" && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
    if (editingField === "description" && descInputRef.current) {
      descInputRef.current.focus();
      descInputRef.current.select();
    }
  }, [editingField]);

  // Start editing a field
  const startEdit = (field: "title" | "description") => {
    setEditValue(field === "title" ? sectionTitle : sectionDescription);
    setEditingField(field);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  // Save edited field
  const saveEdit = async () => {
    if (!editingField) return;
    const trimmed = editValue.trim();
    if (!trimmed && editingField === "title") return;

    setSaving(true);
    try {
      const body =
        editingField === "title"
          ? { title: trimmed }
          : { description: trimmed };

      const res = await fetch("/api/video/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        if (editingField === "title") setSectionTitle(trimmed);
        else setSectionDescription(trimmed);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
      setEditingField(null);
      setEditValue("");
    }
  };

  // Handle Enter/Escape in edit mode
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Video source URL for active video
  const activeVideoSrc =
    videos.length > 0
      ? `/api/video/stream?file=${encodeURIComponent(videos[activeIndex]?.name || "")}`
      : "";

  // Play/pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // Mute toggle
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // Navigate to next/prev video
  const goNext = useCallback(() => {
    if (videos.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % videos.length);
    setVideoError(false);
    setIsPlaying(false);
  }, [videos.length]);

  const goPrev = useCallback(() => {
    if (videos.length === 0) return;
    setActiveIndex((prev) => (prev - 1 + videos.length) % videos.length);
    setVideoError(false);
    setIsPlaying(false);
  }, [videos.length]);

  // Select video from playlist
  const selectVideo = useCallback((index: number) => {
    setActiveIndex(index);
    setVideoError(false);
    setIsPlaying(false);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (editingField) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          goNext();
          break;
        case "ArrowLeft":
          goPrev();
          break;
        case "m":
          toggleMute();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, goNext, goPrev, toggleMute, editingField]);

  // Reset state when video changes
  useEffect(() => {
    setVideoError(false);
    setIsPlaying(false);
  }, [activeIndex]);

  const pluralize = (n: number, one: string, few: string, many: string): string => {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (last > 1 && last < 5) return few;
    if (last === 1) return one;
    return many;
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/knowledge/course-map">Обучение</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{sectionTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </motion.div>

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20">
            <MonitorPlay className="h-6 w-6 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {editingField === "title" ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    className="text-2xl font-bold md:text-3xl bg-transparent border-b-2 border-purple-400 outline-none text-foreground flex-1 min-w-0"
                    maxLength={80}
                  />
                  <button onClick={saveEdit} disabled={saving} className="p-1 rounded hover:bg-purple-500/20 text-purple-400 transition-colors">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button onClick={cancelEdit} className="p-1 rounded hover:bg-white/10 text-muted-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold md:text-3xl">{sectionTitle}</h1>
                  {isAdmin && (
                    <button onClick={() => startEdit("title")} className="p-1 rounded hover:bg-purple-500/20 text-muted-foreground/40 hover:text-purple-400 transition-colors" title="Редактировать название">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
              {videos.length > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/25">
                  {videos.length} {pluralize(videos.length, "урок", "урока", "уроков")}
                </Badge>
              )}
            </div>
            {editingField === "description" ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  ref={descInputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="text-sm bg-transparent border-b-2 border-purple-400 outline-none text-muted-foreground flex-1 min-w-0"
                  maxLength={200}
                />
                <button onClick={saveEdit} disabled={saving} className="p-1 rounded hover:bg-purple-500/20 text-purple-400 transition-colors">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button onClick={cancelEdit} className="p-1 rounded hover:bg-white/10 text-muted-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-muted-foreground text-sm">{sectionDescription}</p>
                {isAdmin && (
                  <button onClick={() => startEdit("description")} className="p-1 rounded hover:bg-purple-500/20 text-muted-foreground/40 hover:text-purple-400 transition-colors shrink-0" title="Редактировать описание">
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Main Content */}
        {loading ? (
          <div className="space-y-4">
            <div className="glass rounded-2xl overflow-hidden">
              <Skeleton className="w-full h-[400px]" />
            </div>
          </div>
        ) : videos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <MonitorPlay className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-muted-foreground">Видеокурсы недоступны</h3>
            <p className="text-sm text-muted-foreground/60 mt-2">
              Медиа-сервер временно недоступен. Попробуйте позже.
            </p>
            <Link
              href="/knowledge/course-map"
              className="text-sm text-emerald-400 hover:underline mt-4 inline-flex items-center gap-1"
            >
              <BookOpen className="h-4 w-4" />
              Вернуться к карте обучения
            </Link>
          </motion.div>
        ) : (
          <div className="flex gap-4">
            {/* Video Player + Cheat Sheet */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="flex-1 min-w-0 space-y-4"
            >
              <div className="glass rounded-2xl overflow-hidden border border-white/5">
                {/* Video Element */}
                <div className="relative bg-black aspect-video">
                  {videoError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
                      <AlertCircle className="h-12 w-12 mb-3 text-red-400/60" />
                      <p className="text-sm">Ошибка воспроизведения видео</p>
                      <p className="text-xs text-white/40 mt-1">
                        {videos[activeIndex]?.title}
                      </p>
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      key={activeVideoSrc}
                      src={activeVideoSrc}
                      className="w-full h-full"
                      controls
                      playsInline
                      onError={() => setVideoError(true)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />
                  )}
                </div>

                {/* Video Controls Bar */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-foreground truncate">
                        ▷ {videos[activeIndex]?.title || "Загрузка..."}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Урок {activeIndex + 1} из {videos.length}
                      </p>
                    </div>
                  </div>

                  {/* Navigation Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={goPrev}
                      disabled={activeIndex === 0 && videos.length <= 1}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                    >
                      <SkipBack className="h-3.5 w-3.5" />
                      Назад
                    </button>
                    <button
                      onClick={togglePlay}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-purple-200 transition-colors border border-purple-500/25"
                    >
                      {isPlaying ? (
                        <><Pause className="h-3.5 w-3.5" />Пауза</>
                      ) : (
                        <><Play className="h-3.5 w-3.5" />Воспроизвести</>
                      )}
                    </button>
                    <button
                      onClick={goNext}
                      disabled={activeIndex === videos.length - 1 && videos.length <= 1}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                    >
                      Далее
                      <SkipForward className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex-1" />

                    <button
                      onClick={toggleMute}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

            </motion.div>

            {/* Playlist Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="hidden lg:block w-72 shrink-0"
            >
              <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                {/* Playlist Header */}
                <div className="p-3 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Плейлист</h3>
                    <Badge variant="secondary" className="text-[9px] bg-purple-500/15 text-purple-300">
                      {activeIndex + 1}/{videos.length}
                    </Badge>
                  </div>
                </div>

                {/* Playlist Items */}
                <div className="max-h-[500px] overflow-y-auto">
                  {videos.map((video, idx) => (
                    <button
                      key={video.name}
                      onClick={() => selectVideo(idx)}
                      className={`w-full text-left px-3 py-2.5 border-b border-white/5 transition-colors ${
                        idx === activeIndex
                          ? "bg-purple-500/10 border-l-2 border-l-purple-400"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold ${
                            idx === activeIndex
                              ? "bg-purple-500/20 text-purple-300"
                              : idx < activeIndex
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-white/5 text-muted-foreground/50"
                          }`}
                        >
                          {idx === activeIndex ? (
                            <Play className="h-3 w-3" />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs font-medium truncate ${
                              idx === activeIndex
                                ? "text-purple-300"
                                : "text-foreground/80"
                            }`}
                          >
                            {video.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                            Урок {idx + 1}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-center py-2"
        >
          <p className="text-[10px] text-muted-foreground/40">
            {sectionTitle} — видео с медиа-сервера
          </p>
        </motion.div>
      </div>

    </AppLayout>
  );
}
