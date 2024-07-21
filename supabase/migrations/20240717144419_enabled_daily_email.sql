UPDATE 
    "public"."list"
SET
    contents = jsonb_set(contents, '{enabled_daily_email}', 'false'::jsonb)
WHERE 
    contents IS NOT NULL;