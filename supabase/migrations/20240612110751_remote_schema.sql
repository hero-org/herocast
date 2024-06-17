drop policy "Enable read access for all users" on "public"."channel";

create policy "Enable read access for all users"
on "public"."channel"
as permissive
for select
to authenticated, anon
using (true);



