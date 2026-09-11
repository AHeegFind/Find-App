// Hand-written types mirroring supabase/migrations/0001_init.sql.
// If you have the Supabase CLI, regenerate this with:
//   supabase gen types typescript --local > types/database.ts
// and re-apply any manual comments you want to keep.

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected" | "suspended";
export type ModerationStatus = "pending" | "approved" | "rejected";
export type Availability = "in_stock" | "customizable" | "sold_out";
export type SourceType = "seller_submitted" | "web_indexed";
export type ProductVerification = "find_verified" | "found_online";
export type UserRole = "consumer" | "seller" | "admin";
export type AIJobType = "vision_analysis" | "image_generation" | "embedding" | "moderation";
export type AIJobStatus = "pending" | "processing" | "succeeded" | "failed";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["users"]["Row"]> & { id: string; email: string };
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
      };
      categories: {
        Row: {
          id: string;
          parent_id: string | null;
          slug: string;
          label: string;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["categories"]["Row"]> & { slug: string; label: string };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
      };
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          bio: string | null;
          location: string | null;
          logo_url: string | null;
          whatsapp: string | null;
          instagram: string | null;
          tiktok: string | null;
          website: string | null;
          verification_status: VerificationStatus;
          verified_at: string | null;
          verified_by: string | null;
          suspension_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["businesses"]["Row"]> & { owner_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["businesses"]["Row"]>;
      };
      seller_applications: {
        Row: {
          id: string;
          business_id: string;
          applicant_id: string;
          status: "pending" | "approved" | "rejected";
          business_registration_notes: string | null;
          supporting_links: string[] | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["seller_applications"]["Row"]> & { business_id: string; applicant_id: string };
        Update: Partial<Database["public"]["Tables"]["seller_applications"]["Row"]>;
      };
      products: {
        Row: {
          id: string;
          business_id: string | null;
          category_id: string | null;
          name: string;
          description: string | null;
          price: number;
          currency: string;
          location: string | null;
          dimensions: string | null;
          material: string | null;
          colour: string | null;
          availability: Availability;
          source_type: SourceType;
          source_website: string | null;
          source_url: string | null;
          verification_status: ProductVerification;
          moderation_status: ModerationStatus;
          moderated_by: string | null;
          moderated_at: string | null;
          featured: boolean;
          discover_sections: string[];
          search_tags: string[];
          last_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & { name: string; price: number };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          raw_image_url: string;
          processed_image_url: string | null;
          is_primary: boolean;
          approved: boolean;
          embedding: number[] | null;
          vision_labels: Record<string, unknown> | null;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_images"]["Row"]> & { product_id: string; raw_image_url: string };
        Update: Partial<Database["public"]["Tables"]["product_images"]["Row"]>;
      };
      searches: {
        Row: {
          id: string;
          user_id: string | null;
          query_type: "image" | "text";
          query_text: string | null;
          query_image_url: string | null;
          detected_tags: string[] | null;
          result_count: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["searches"]["Row"]> & { query_type: "image" | "text" };
        Update: Partial<Database["public"]["Tables"]["searches"]["Row"]>;
      };
      saved_products: {
        Row: { user_id: string; product_id: string; created_at: string };
        Insert: { user_id: string; product_id: string };
        Update: never;
      };
      find_it_requests: {
        Row: {
          id: string;
          user_id: string | null;
          name: string | null;
          email: string;
          whatsapp: string | null;
          query_image_url: string | null;
          detected_tags: string[] | null;
          item_type: string | null;
          notes: string | null;
          status: "open" | "matched" | "closed";
          matched_product_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["find_it_requests"]["Row"]> & { email: string };
        Update: Partial<Database["public"]["Tables"]["find_it_requests"]["Row"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          business_id: string;
          plan: "free" | "pro" | "enterprise";
          status: "active" | "past_due" | "cancelled";
          current_period_end: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]> & { business_id: string };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
      };
      featured_slots: {
        Row: {
          id: string;
          product_id: string;
          discover_section: string | null;
          placement_type: "discover" | "search_keyword" | "search_visual" | "promoted";
          keywords: string[];
          position_tier: "top" | "standard";
          price: number;
          currency: string;
          status: "offered" | "paid" | "live" | "expired" | "lapsed" | "cancelled";
          offered_at: string;
          payment_deadline: string;
          paid_at: string | null;
          start_date: string | null;
          end_date: string | null;
          duration_days: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["featured_slots"]["Row"]> & { product_id: string; price: number; payment_deadline: string };
        Update: Partial<Database["public"]["Tables"]["featured_slots"]["Row"]>;
      };
      product_views: {
        Row: {
          id: string;
          product_id: string;
          user_id: string | null;
          source: "browse" | "discover" | "search_image" | "search_text";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_views"]["Row"]> & { product_id: string };
        Update: never;
      };
      ai_processing_jobs: {
        Row: {
          id: string;
          product_id: string | null;
          product_image_id: string | null;
          job_type: AIJobType;
          provider: string;
          status: AIJobStatus;
          input: Record<string, unknown> | null;
          output: Record<string, unknown> | null;
          error_message: string | null;
          attempts: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_processing_jobs"]["Row"]> & { job_type: AIJobType; provider: string };
        Update: Partial<Database["public"]["Tables"]["ai_processing_jobs"]["Row"]>;
      };
    };
    Functions: {
      match_products: {
        Args: { query_embedding: number[]; match_threshold?: number; match_count?: number };
        Returns: { product_id: string; similarity: number }[];
      };
    };
  };
}
