import { NextResponse } from "next/server";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";

/**
 * Test endpoint: generates signed URL, strips x-amz-checksum-mode,
 * and tests if Selectel accepts the modified URL.
 * TEMPORARY — remove after debugging.
 */
export async function GET() {
  const s3Provider = new S3StorageProvider();

  try {
    // Generate signed URL for the CLAUDE CODE video
    const key = "knowledge/articles/CLAUDE CODE full ";
    const resolved = await s3Provider.resolveKey(key);
    const actualKey = resolved?.key || key;

    // Get the signed URL (with x-amz-checksum-mode already stripped by getSignedUrl)
    const signedUrl = await s3Provider.getSignedUrl(actualKey, 3600);

    const hasChecksumMode = signedUrl.includes("checksum-mode");

    // Test the signed URL with a small Range request
    let testResult = "not_tested";
    let testStatus = 0;
    let testSize = 0;
    try {
      const testResponse = await fetch(signedUrl, {
        headers: { Range: "bytes=0-1023" },
        redirect: "follow",
      });
      testStatus = testResponse.status;
      testSize = parseInt(testResponse.headers.get("Content-Length") || "0");
      if (testResponse.ok || testResponse.status === 206) {
        testResult = "SUCCESS";
        // Consume the body
        await testResponse.arrayBuffer();
      } else {
        testResult = "FAILED";
        const text = await testResponse.text().catch(() => "");
        testResult = `FAILED: ${testResponse.status} - ${text.substring(0, 200)}`;
      }
    } catch (e: unknown) {
      testResult = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    return NextResponse.json({
      key: actualKey,
      hasChecksumMode,
      signedUrlPreview: signedUrl.substring(0, 300),
      testResult,
      testStatus,
      testSize,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
