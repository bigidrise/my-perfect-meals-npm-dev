import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function presignUpload({
  bucket,
  key,
  contentType,
  expiresIn = 60 * 5, // 5 minutes
}: {
  bucket: string;
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ACL: "public-read" });
  const url = await getSignedUrl(s3, command, { expiresIn });
  // Public URL (if bucket policy allows public-read)
  const publicUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return { url, publicUrl };
}