-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "counts_as_spending" BOOLEAN NOT NULL DEFAULT true;

-- seed:categories (idempotent). Money moved between the owner's own accounts is not spending.
INSERT INTO "categories" ("id", "name", "color", "counts_as_spending") VALUES
    (gen_random_uuid(), 'Transferências próprias', '#78716c', false)
ON CONFLICT ("name") DO NOTHING;
