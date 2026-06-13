import { NextRequest, NextResponse } from "next/server";

const PIPED_API_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://piped-api.privacy.com.de",
  "https://pipedapi.in.projectsegfau.lt",
];

interface PipedStream {
  url: string;
  format: string;
  quality: string;
  mimeType: string;
  codec: string;
  videoOnly: boolean;
  bitrate: number;
  contentLength: number;
}

interface PipedResponse {
  title: string;
  duration: number;
  thumbnailUrl: string;
  videoStreams: PipedStream[];
  audioStreams: PipedStream[];
}

async function fetchFromPiped(videoId: string): Promise<PipedResponse | null> {
  for (const instance of PIPED_API_INSTANCES) {
    try {
      const res = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "obuchAI/1.0",
          "Accept": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.videoStreams || data.audioStreams) return data as PipedResponse;
      }
    } catch {
      // Try next instance
      continue;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  try {
    const data = await fetchFromPiped(videoId);

    if (!data) {
      return NextResponse.json(
        { error: "Failed to fetch video info from all Piped instances" },
        { status: 502 }
      );
    }

    // Find the best progressive stream (video+audio combined)
    const progressiveStreams = (data.videoStreams || []).filter(
      (s) => !s.videoOnly && s.mimeType?.startsWith("video/mp4")
    );

    // Sort by quality (higher bitrate = better)
    progressiveStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    let streamUrl: string | null = null;
    let quality = "";
    let isVideoOnly = false;

    if (progressiveStreams.length > 0) {
      // Best progressive stream (video+audio)
      streamUrl = progressiveStreams[0].url;
      quality = progressiveStreams[0].quality;
      isVideoOnly = false;
    } else {
      // Fallback: best video-only stream (no audio, but at least shows something)
      const videoOnlyStreams = (data.videoStreams || []).filter(
        (s) => s.videoOnly && s.mimeType?.startsWith("video/mp4")
      );
      videoOnlyStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (videoOnlyStreams.length > 0) {
        streamUrl = videoOnlyStreams[0].url;
        quality = videoOnlyStreams[0].quality + " (без звука)";
        isVideoOnly = true;
      }

      // Try webm as last resort
      if (!streamUrl) {
        const webmStreams = (data.videoStreams || []).filter(
          (s) => !s.videoOnly && s.mimeType?.startsWith("video/webm")
        );
        webmStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        if (webmStreams.length > 0) {
          streamUrl = webmStreams[0].url;
          quality = webmStreams[0].quality;
          isVideoOnly = false;
        }
      }
    }

    // Find best audio stream if we need to provide separate audio
    const audioStreams = (data.audioStreams || []).filter(
      (s) => s.mimeType?.startsWith("audio/mp4") || s.mimeType?.startsWith("audio/webm")
    );
    audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const audioUrl = audioStreams.length > 0 ? audioStreams[0].url : null;

    return NextResponse.json({
      title: data.title || "",
      duration: data.duration || 0,
      thumbnail: data.thumbnailUrl || "",
      streamUrl,
      audioUrl,
      quality,
      isVideoOnly,
      // Provide piped embed URL as fallback
      pipedEmbedUrl: `https://piped.video/embed/${videoId}`,
    });
  } catch (error) {
    console.error("[video/youtube-info] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
