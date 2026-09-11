// Client-side helper for uploading raw seller images to Supabase Storage.
// Bucket "product-images" must be created in the Supabase dashboard (or via
// the CLI) with public read access — see README setup steps.
import { createClient } from "./client";

export async function uploadProductImage(file: File, businessId: string): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop();
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
