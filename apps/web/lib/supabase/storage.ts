import { createClient } from "./client";

export async function uploadImage(
  bucket: string,
  path: string,
  file: File
): Promise<string> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
  });
  if (error) throw error;
  return getImageUrl(bucket, path);
}

export async function deleteImage(
  bucket: string,
  path: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function getImageUrl(bucket: string, path: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Available buckets
export const BUCKETS = {
  PRODUCT_IMAGES: "product-images",
  GENERATED_IMAGES: "generated-images",
  REFERENCE_IMAGES: "reference-images",
} as const;
