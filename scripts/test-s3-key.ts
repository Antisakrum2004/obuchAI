import { S3Client, HeadObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "ru-7",
  endpoint: "https://s3.ru-7.storage.selcloud.ru",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const bucket = "ati-lab";

async function main() {
  // 1. List objects with "CLAUDE" prefix
  console.log("=== ListObjectsV2: CLAUDE ===");
  const list = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: "knowledge/articles/CLAUDE",
    MaxKeys: 20,
  }));
  if (list.Contents) {
    for (const obj of list.Contents) {
      console.log(`Key: "${obj.Key}" Size: ${obj.Size} LastModified: ${obj.LastModified}`);
    }
  } else {
    console.log("No objects found!");
  }

  // 2. Try HeadObject with exact key (with trailing space)
  console.log("\n=== HeadObject: with trailing space ===");
  try {
    const head1 = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: "knowledge/articles/CLAUDE CODE full " }));
    console.log(`FOUND with trailing space! Size: ${head1.ContentLength} Type: ${head1.ContentType}`);
  } catch (e: any) {
    console.log(`NOT found with trailing space: ${e.name}`);
  }

  // 3. Try HeadObject without trailing space
  console.log("\n=== HeadObject: without trailing space ===");
  try {
    const head2 = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: "knowledge/articles/CLAUDE CODE full" }));
    console.log(`FOUND without trailing space! Size: ${head2.ContentLength} Type: ${head2.ContentType}`);
  } catch (e: any) {
    console.log(`NOT found without trailing space: ${e.name}`);
  }

  // 4. Try with .mp4 extension
  console.log("\n=== HeadObject: with .mp4 ===");
  try {
    const head3 = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: "knowledge/articles/CLAUDE CODE full.mp4" }));
    console.log(`FOUND with .mp4! Size: ${head3.ContentLength} Type: ${head3.ContentType}`);
  } catch (e: any) {
    console.log(`NOT found with .mp4: ${e.name}`);
  }

  // 5. Test small range read via SDK (first 1024 bytes)
  console.log("\n=== GetObject Range: first 1KB ===");
  try {
    const getObj = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: "knowledge/articles/CLAUDE CODE full",
      Range: "bytes=0-1023",
    }));
    console.log(`SUCCESS! Status: ${getObj.$metadata.httpStatusCode} ContentLength: ${getObj.ContentLength} ContentRange: ${getObj.ContentRange} ContentType: ${getObj.ContentType}`);
    // Consume the stream
    const chunks: Buffer[] = [];
    for await (const chunk of getObj.Body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    console.log(`Stream consumed OK, total bytes: ${Buffer.concat(chunks).length}`);
  } catch (e: any) {
    console.log(`GetObject FAILED: ${e.name}: ${e.message}`);
  }

  // 6. Also check 01 SDD for comparison
  console.log("\n=== HeadObject: 01 SDD.mp4 ===");
  try {
    const head4 = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: "knowledge/articles/01 SDD.mp4" }));
    console.log(`FOUND! Size: ${head4.ContentLength} Type: ${head4.ContentType}`);
  } catch (e: any) {
    console.log(`NOT found: ${e.name}`);
  }

  // 7. List ALL objects under knowledge/articles/
  console.log("\n=== ListObjectsV2: ALL objects ===");
  const listAll = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: "knowledge/articles/",
    MaxKeys: 100,
  }));
  if (listAll.Contents) {
    for (const obj of listAll.Contents) {
      console.log(`Key: "${obj.Key}" Size: ${obj.Size}`);
    }
  }
}

main().catch(console.error);
