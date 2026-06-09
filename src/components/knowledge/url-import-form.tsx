"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Check, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UrlImportFormProps {
  articleId: string;
  initialData?: {
    videoUrl?: string;
    pdfUrl?: string;
    pptxUrl?: string;
    sourceUrl?: string;
    sourceType?: string;
  };
  onSave?: () => void;
}

function detectSourceType(url: string): string | null {
  if (!url) return null;
  // Handle s3:// URIs — private S3 storage (e.g. from S3 console)
  if (url.startsWith("s3://")) return "s3";
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("rutube.ru")) return "rutube";
    if (hostname.includes("vk.com") || hostname.includes("vkvideo")) return "vk";
    if (hostname.includes("disk.yandex") || hostname.includes("yandex")) return "yandex_disk";
    // Detect S3 HTTPS URLs (Selectel Object Storage)
    if (hostname.includes("storage.selcloud.ru") || (hostname.includes("s3.") && hostname.includes(".storage."))) return "s3";
    if (hostname.includes(".pdf")) return "pdf";
    return "other";
  } catch {
    return null;
  }
}

const sourceTypeBadgeConfig: Record<string, { label: string; color: string }> = {
  youtube: { label: "YouTube", color: "border-red-500/30 text-red-400 bg-red-500/10" },
  rutube: { label: "Rutube", color: "border-blue-500/30 text-blue-400 bg-blue-500/10" },
  vk: { label: "VK Видео", color: "border-blue-500/30 text-blue-400 bg-blue-500/10" },
  yandex_disk: { label: "Яндекс Диск", color: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10" },
  s3: { label: "S3 Хранилище", color: "border-blue-500/30 text-blue-400 bg-blue-500/10" },
  pdf: { label: "PDF", color: "border-orange-500/30 text-orange-400 bg-orange-500/10" },
  other: { label: "Ссылка", color: "border-white/10 text-muted-foreground" },
};

function SourceBadge({ url }: { url: string }) {
  const type = detectSourceType(url);
  if (!type) return null;
  const config = sourceTypeBadgeConfig[type] || sourceTypeBadgeConfig.other;
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", config.color)}>
      {config.label}
    </Badge>
  );
}

export function UrlImportForm({ articleId, initialData, onSave }: UrlImportFormProps) {
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl || "");
  const [pdfUrl, setPdfUrl] = useState(initialData?.pdfUrl || "");
  const [pptxUrl, setPptxUrl] = useState(initialData?.pptxUrl || "");
  const [sourceUrl, setSourceUrl] = useState(initialData?.sourceUrl || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      // Auto-detect sourceType from videoUrl
      const detectedSourceType = detectSourceType(videoUrl) || detectSourceType(sourceUrl) || initialData?.sourceType || null;

      const res = await fetch(`/api/knowledge/articles/${encodeURIComponent(articleId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: videoUrl || null,
          pdfUrl: pdfUrl || null,
          pptxUrl: pptxUrl || null,
          sourceUrl: sourceUrl || null,
          sourceType: detectedSourceType,
        }),
      });

      if (res.ok) {
        setSaved(true);
        onSave?.();
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: "videoUrl", label: "Ссылка на видео", value: videoUrl, setter: setVideoUrl, placeholder: "https://youtube.com/... или s3://bucket/key" },
    { key: "pdfUrl", label: "Ссылка на PDF", value: pdfUrl, setter: setPdfUrl, placeholder: "https://example.com/file.pdf" },
    { key: "pptxUrl", label: "Ссылка на презентацию", value: pptxUrl, setter: setPptxUrl, placeholder: "https://example.com/file.pptx" },
    { key: "sourceUrl", label: "Источник", value: sourceUrl, setter: setSourceUrl, placeholder: "https://example.com/article" },
  ];

  return (
    <div className="glass rounded-xl p-5 border-white/5 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <LinkIcon className="h-4 w-4 text-emerald-400" />
        Медиа-ссылки
      </h3>

      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-xs text-muted-foreground">{field.label}</label>
            <div className="flex items-center gap-2">
              <Input
                placeholder={field.placeholder}
                value={field.value}
                onChange={(e) => field.setter(e.target.value)}
                className="bg-white/5 border-white/10 text-sm"
              />
              {field.value && <SourceBadge url={field.value} />}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : saved ? (
          <Check className="h-4 w-4 mr-1" />
        ) : (
          <Save className="h-4 w-4 mr-1" />
        )}
        {saved ? "Сохранено" : "Сохранить ссылки"}
      </Button>
    </div>
  );
}
