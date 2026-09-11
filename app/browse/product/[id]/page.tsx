import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProductDetailClient from "./ProductDetailClient";

// Server component: fetches the real product + primary image + business
// from Postgres, then hands off to the client component for interactivity
// (save button, accordion, contact link).
export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select(
      `*, product_images (id, processed_image_url, raw_image_url, is_primary, sort_order),
       businesses (id, name, location, verification_status, whatsapp, instagram, tiktok, website, bio, created_at)`
    )
    .eq("id", params.id)
    .eq("moderation_status", "approved")
    .single();

  if (error || !product) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isSaved = false;
  if (user) {
    const { data: saved } = await supabase
      .from("saved_products")
      .select("product_id")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle();
    isSaved = !!saved;
  }

  return <ProductDetailClient product={product} initiallySaved={isSaved} isLoggedIn={!!user} />;
}
