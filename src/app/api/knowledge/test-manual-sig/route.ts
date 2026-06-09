import { NextResponse } from "next/server";
import { S3StorageProvider } from "@/lib/storage/s3-storage-provider";

export async function GET() {
  const s3Provider = new S3StorageProvider();
  try {
    const key = "knowledge/articles/CLAUDE CODE full ";
    const resolved = await s3Provider.resolveKey(key);
    const actualKey = resolved?.key || key;
    const signedUrl = await s3Provider.getSignedUrl(actualKey, 3600);

    // Test with Range request
    let testResult = "not_tested";
    let testStatus = 0;
    try {
      const r = await fetch(signedUrl, { headers: { Range: "bytes=0-1023" }, redirect: "follow" });
      testStatus = r.status;
      if (r.ok || r.status === 206) {
        testResult = "SUCCESS";
        await r.arrayBuffer();
      } else {
        const text = await r.text().catch(() => "");
        testResult = "FAILED: " + text.substring(0, 300);
      }
    } catch (e: unknown) {
      testResult = "ERROR: " + (e instanceof Error ? e.message : String(e));
    }

    // Also test 01 SDD
    const sddKey = "knowledge/articles/01 SDD.mp4";
    const sddUrl = await s3Provider.getSignedUrl(sddKey, 3600);
    let sddResult = "not_tested";
    try {
      const r2 = await fetch(sddUrl, { headers: { Range: "bytes=0-1023" }, redirect: "follow" });
      if (r2.ok || r2.status === 206) {
        sddResult = "SUCCESS";
        await r2.arrayBuffer();
      } else {
        sddResult = "FAILED: " + r2.status;
      }
    } catch (e: unknown) {
      sddResult = "ERROR: " + (e instanceof Error ? e.message : String(e));
    }

    return NextResponse.json({
      claudeCode: { hasChecksumMode: signedUrl.includes("checksum-mode"), testResult, testStatus },
      sdd: { hasChecksumMode: sddUrl.includes("checksum-mode"), testResult: sddResult },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
