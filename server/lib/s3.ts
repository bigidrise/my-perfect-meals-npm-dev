import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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
  expiresIn = 60 * 5,
}: {
  bucket: string;
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ACL: "public-read" });
  const url = await getSignedUrl(s3, command, { expiresIn });
  const publicUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return { url, publicUrl };
}

export async function uploadPrivateObject({
  bucket,
  key,
  body,
  contentType,
}: {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getSignedGetUrl({
  bucket,
  key,
  expiresIn = 60 * 20,
}: {
  bucket: string;
  key: string;
  expiresIn?: number;
}): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}