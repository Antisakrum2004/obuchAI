"use client";

import { useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useUserStore } from "@/store/user-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { toProxyAvatarUrl } from "@/lib/avatar-url";

interface AvatarUploaderProps {
  /** Current image URL (from profile data) */
  currentImage: string | null;
  /** User name for fallback initials */
  name?: string | null;
  /** Whether this is the user's own profile (shows upload UI) */
  isOwn: boolean;
  /** Additional class */
  className?: string;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export function AvatarUploader({
  currentImage,
  name,
  isOwn,
  className,
}: AvatarUploaderProps) {
  const { update: updateSession } = useSession();
  const setUser = useUserStore((s) => s.setUser);

  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert legacy S3 URLs to proxy format
  const displayImage = toProxyAvatarUrl(avatarUrl || currentImage);
  const avatarKey = displayImage ? displayImage + Date.now() : "fallback";
  const initial = name?.charAt(0)?.toUpperCase() || "U";

  const handleClick = useCallback(() => {
    if (!isOwn || uploading) return;
    fileInputRef.current?.click();
  }, [isOwn, uploading]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset error
      setError(null);

      // Validate type
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Неподдерживаемый формат. Допустимы: JPEG, PNG, WebP");
        return;
      }

      // Validate size
      if (file.size > MAX_SIZE) {
        setError("Файл слишком большой. Максимум 2 МБ");
        return;
      }

      // Upload
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("avatar", file);

        const res = await fetch("/api/user/avatar", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Ошибка загрузки");
        }

        const data = await res.json();
        const newUrl = data.url; // Already contains ?t= cache-bust

        // 1. Update NextAuth session FIRST (ensures consistency)
        await updateSession({ image: newUrl });

        // 2. Then update Zustand store for instant header update
        setUser({ image: newUrl });

        // 3. Update local state
        setAvatarUrl(newUrl);
      } catch (err) {
        console.error("[AvatarUploader] Upload failed:", err);
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setUploading(false);
        // Reset file input so the same file can be re-selected
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [updateSession, setUser]
  );

  return (
    <div className={cn("relative group", className)}>
      <div
        onClick={handleClick}
        className={cn(
          "relative w-[100px] h-[100px] rounded-full overflow-hidden",
          isOwn && "cursor-pointer"
        )}
      >
        <Avatar className="w-full h-full">
          <AvatarImage
            key={avatarKey}
            src={displayImage || undefined}
            alt={name || ""}
            className="object-cover"
          />
          <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-2xl font-bold">
            {initial}
          </AvatarFallback>
        </Avatar>

        {/* Overlay on hover — only for own profile */}
        {isOwn && !uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
            <Camera className="h-6 w-6 text-white" />
          </div>
        )}

        {/* Spinner overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
            <Loader2 className="h-7 w-7 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      {isOwn && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      )}

      {/* Error text */}
      {error && (
        <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-red-400 whitespace-nowrap">
          {error}
        </p>
      )}
    </div>
  );
}
