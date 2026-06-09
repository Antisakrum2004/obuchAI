# Task 3 - Fix Video ERR_CONNECTION_RESET via Streaming Proxy

## Summary
Fixed the ERR_CONNECTION_RESET error when streaming video from Selectel S3 by implementing a server-side streaming proxy. The browser now never connects to S3 directly.

## Changes Made

### 1. `/home/z/my-project/src/app/api/knowledge/video/by-article/[articleId]/route.ts`
- **Added streaming proxy mode**: When no `?format=json` param, fetches video from S3 server-side and streams response to browser
- **HTTP Range support**: Proxies Range headers to S3, returns 206 Partial Content responses with Content-Range headers
- **Backward compatibility**: `?format=json` still returns signed URL as JSON
- **Non-S3 URLs**: YouTube/Rutube/etc. still redirect directly (no proxy needed)
- **Preserved**: Auth check, fileKey migration, extractS3Key, resolveKey logic unchanged

### 2. `/home/z/my-project/src/lib/storage/s3-storage-provider.ts`
- **Removed `ResponseContentType`** from GetObjectCommand (was adding `response-content-type` to signed URLs)
- **Added `getPresigningClient()`**: Separate S3Client with middleware to remove `ChecksumMode` parameter before presigning, preventing `x-amz-checksum-mode=ENABLED` from appearing in signed URLs (Selectel doesn't support this parameter)
- **Presigning client cached** as singleton via globalForPresigning

### 3. `/home/z/my-project/src/components/knowledge/video-embed.tsx`
- **Simplified ProtectedVideoPlayer**: Removed `fetchSignedUrl` logic — now uses `apiPath` directly as `<video src>`
- **Video element always rendered** (with `sr-only` while loading) instead of conditional rendering
- **Event-driven state management**: `onLoadStart`, `onCanPlay`, `onError`, `onWaiting`, `onPlaying`
- **Retry mechanism**: `key={retryCount}` forces video element reload on retry
- **Other players unchanged**: YouTube, Rutube, YandexDisk, etc.

### 4. `/home/z/my-project/scripts/setup-s3-cors.js` (new file)
- Configures CORS on Selectel S3 bucket
- Allowed origins: obuch-ai.vercel.app, localhost:3000
- Allowed methods: GET, Allowed headers: Range, Content-Type
- Expose headers: Content-Range, Content-Length, Accept-Ranges

### 5. No changes to `/home/z/my-project/src/app/knowledge/article/[id]/page.tsx`
- Already passes correct API path `/api/knowledge/video/by-article/${article.id}` for S3 videos

## Build Status
- ✅ `npm run build` passes successfully
- ✅ No new lint errors introduced
