-- Nubank repeats the FITID across related card lines: every installment of a purchase, its IOF
-- charge and its refund carry the purchase's FITID. The statement reader now appends a suffix
-- that makes each line unique. This migration brings rows stored before that change in line, so
-- importing the same files again matches them instead of duplicating or skipping lines.
-- Every step is safe to run on a database that has no such rows.

-- step: installments get "#p<number>/<total>"
UPDATE "transactions" AS t
SET "external_id" = t."external_id" || '#p' || t."installment_number" || '/' || t."installment_total"
FROM "accounts" AS a
WHERE a."id" = t."account_id"
  AND a."source" = 'CREDIT_CARD'
  AND t."installment_number" IS NOT NULL
  AND position('#' IN t."external_id") = 0;

-- step: IOF charges get "#iof"
UPDATE "transactions" AS t
SET "external_id" = t."external_id" || '#iof'
FROM "accounts" AS a
WHERE a."id" = t."account_id"
  AND a."source" = 'CREDIT_CARD'
  AND t."description" ~ '^IOF de ".+"$'
  AND position('#' IN t."external_id") = 0;

-- step: refunds get "#refund"
UPDATE "transactions" AS t
SET "external_id" = t."external_id" || '#refund'
FROM "accounts" AS a
WHERE a."id" = t."account_id"
  AND a."source" = 'CREDIT_CARD'
  AND t."description" ~ '^Estorno de ".+"'
  AND position('#' IN t."external_id") = 0;

-- step: card credits other than bill payments are refunds
UPDATE "transactions" AS t
SET "kind" = 'CARD_REFUND'
FROM "accounts" AS a
WHERE a."id" = t."account_id"
  AND a."source" = 'CREDIT_CARD'
  AND t."kind" = 'CARD_PURCHASE'
  AND t."amount_cents" > 0;

-- step: the merchant of IOF lines is "IOF"
INSERT INTO "merchants" ("id", "name", "updated_at")
SELECT gen_random_uuid(), 'IOF', now()
WHERE EXISTS (
  SELECT 1 FROM "transactions" WHERE "description" ~ '^IOF de ".+"$' OR "description" ~ '^IOF de volta de '
)
ON CONFLICT ("name") DO NOTHING;

-- step: point IOF lines at that merchant
UPDATE "transactions" AS t
SET "merchant_id" = m."id"
FROM "accounts" AS a, "merchants" AS m
WHERE a."id" = t."account_id"
  AND a."source" = 'CREDIT_CARD'
  AND m."name" = 'IOF'
  AND (t."description" ~ '^IOF de ".+"$' OR t."description" ~ '^IOF de volta de ')
  AND t."merchant_id" IS DISTINCT FROM m."id";

-- step: the merchant of a refund is the merchant of the purchase
INSERT INTO "merchants" ("id", "name", "updated_at")
SELECT gen_random_uuid(), r."name", now()
FROM (
  SELECT DISTINCT upper(regexp_replace(btrim(substring(t."description" FROM '^Estorno de "(.+?)"')), '\s+', ' ', 'g')) AS "name"
  FROM "transactions" AS t
  WHERE t."description" ~ '^Estorno de ".+?"'
) AS r
WHERE r."name" <> ''
ON CONFLICT ("name") DO NOTHING;

-- step: point refunds at that merchant
UPDATE "transactions" AS t
SET "merchant_id" = m."id"
FROM "accounts" AS a, "merchants" AS m
WHERE a."id" = t."account_id"
  AND a."source" = 'CREDIT_CARD'
  AND t."description" ~ '^Estorno de ".+?"'
  AND m."name" = upper(regexp_replace(btrim(substring(t."description" FROM '^Estorno de "(.+?)"')), '\s+', ' ', 'g'))
  AND t."merchant_id" IS DISTINCT FROM m."id";

-- step: refunds follow the category of their merchant, like any transaction not corrected by hand
UPDATE "transactions" AS t
SET "category_id" = m."category_id",
    "category_source" = CASE WHEN m."category_id" IS NULL THEN NULL ELSE 'RULE'::"CategorySource" END
FROM "merchants" AS m
WHERE t."merchant_id" = m."id"
  AND t."kind" = 'CARD_REFUND'
  AND t."category_source" IS DISTINCT FROM 'MANUAL'
  AND t."category_id" IS DISTINCT FROM m."category_id";

-- step: drop merchants left without transactions
DELETE FROM "merchants" AS m
WHERE NOT EXISTS (SELECT 1 FROM "transactions" AS t WHERE t."merchant_id" = m."id");

-- seed:category_rules (idempotent). More default rules, found while importing real statements.
INSERT INTO "category_rules" ("id", "pattern", "category_id")
SELECT gen_random_uuid(), r."pattern", c."id"
FROM (VALUES
    ('AMAZONPRIME', 'Assinaturas'),
    ('MICROSOFT', 'Assinaturas'),
    ('MUFFATO', 'Mercado'),
    ('ANGELONI', 'Mercado'),
    ('RAIA', 'Saúde'),
    ('DROGASIL', 'Saúde'),
    ('WELLHUB', 'Saúde'),
    ('GYMPASS', 'Saúde')
) AS r("pattern", "category")
JOIN "categories" c ON c."name" = r."category"
ON CONFLICT ("pattern") DO NOTHING;
