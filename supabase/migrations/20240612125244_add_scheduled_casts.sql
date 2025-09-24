create extension if not exists moddatetime schema extensions;

CREATE TABLE IF NOT EXISTS "public"."draft" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "scheduled_for" timestamp with time zone,
    "account_id" "uuid" NOT NULL,
    "data" "jsonb",
    "status" "text" DEFAULT 'writing'::text,
    constraint draft_pkey primary key (id),
    constraint public_draft_account_id_fkey foreign key (account_id) references accounts (id) on delete cascade
);

CREATE POLICY "Enable access to rows for users" ON "public"."draft" USING ("public"."is_account_of_user"("auth"."uid"(), "account_id")) WITH CHECK (true);

ALTER TABLE "public"."draft" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."draft" TO "anon";
GRANT ALL ON TABLE "public"."draft" TO "authenticated";
GRANT ALL ON TABLE "public"."draft" TO "service_role";

create or replace trigger handle_updated_at before update on draft
  for each row execute procedure moddatetime (updated_at);
