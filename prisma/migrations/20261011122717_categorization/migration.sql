-- The default only fills rows that may already exist; categories always state their color.
ALTER TABLE "categories" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#94a3b8';
ALTER TABLE "categories" ALTER COLUMN "color" DROP DEFAULT;

-- CreateTable
CREATE TABLE "category_rules" (
    "id" UUID NOT NULL,
    "pattern" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_rules_pattern_key" ON "category_rules"("pattern");

-- CreateIndex
CREATE INDEX "category_rules_category_id_idx" ON "category_rules"("category_id");

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- seed:categories (idempotent)
INSERT INTO "categories" ("id", "name", "color") VALUES
    (gen_random_uuid(), 'Alimentação', '#f97316'),
    (gen_random_uuid(), 'Mercado', '#65a30d'),
    (gen_random_uuid(), 'Transporte', '#0ea5e9'),
    (gen_random_uuid(), 'Moradia', '#8b5cf6'),
    (gen_random_uuid(), 'Saúde', '#ef4444'),
    (gen_random_uuid(), 'Lazer', '#ec4899'),
    (gen_random_uuid(), 'Assinaturas', '#6366f1'),
    (gen_random_uuid(), 'Compras', '#f59e0b'),
    (gen_random_uuid(), 'Educação', '#14b8a6'),
    (gen_random_uuid(), 'Pets', '#a16207'),
    (gen_random_uuid(), 'Serviços e taxas', '#64748b'),
    (gen_random_uuid(), 'Pessoas', '#06b6d4'),
    (gen_random_uuid(), 'Renda', '#10b981'),
    (gen_random_uuid(), 'Outros', '#94a3b8')
ON CONFLICT ("name") DO NOTHING;

-- seed:category_rules (idempotent). A rule applies when a word of the merchant name starts with its pattern;
-- the longest matching pattern wins, so 'UBER EATS' beats 'UBER' and 'AMAZON PRIME' beats 'AMAZON'.
INSERT INTO "category_rules" ("id", "pattern", "category_id")
SELECT gen_random_uuid(), r."pattern", c."id"
FROM (VALUES
    ('IFOOD', 'Alimentação'),
    ('IFD', 'Alimentação'),
    ('RAPPI', 'Alimentação'),
    ('UBER EATS', 'Alimentação'),
    ('RESTAURANTE', 'Alimentação'),
    ('PADARIA', 'Alimentação'),
    ('LANCHONETE', 'Alimentação'),
    ('LANCHES', 'Alimentação'),
    ('PIZZ', 'Alimentação'),
    ('BURGER', 'Alimentação'),
    ('MCDONALD', 'Alimentação'),
    ('SUBWAY', 'Alimentação'),
    ('STARBUCKS', 'Alimentação'),
    ('CAFETERIA', 'Alimentação'),
    ('SORVET', 'Alimentação'),
    ('ACAI', 'Alimentação'),
    ('CHURRASC', 'Alimentação'),
    ('SUPERMERC', 'Mercado'),
    ('MERCADINHO', 'Mercado'),
    ('MERCEARIA', 'Mercado'),
    ('MINIMERCADO', 'Mercado'),
    ('ATACAD', 'Mercado'),
    ('CARREFOUR', 'Mercado'),
    ('ASSAI', 'Mercado'),
    ('HORTIFRUTI', 'Mercado'),
    ('ACOUGUE', 'Mercado'),
    ('UBER', 'Transporte'),
    ('99APP', 'Transporte'),
    ('99 TAXI', 'Transporte'),
    ('POSTO', 'Transporte'),
    ('IPIRANGA', 'Transporte'),
    ('SHELL', 'Transporte'),
    ('SEM PARAR', 'Transporte'),
    ('ESTACIONAMENTO', 'Transporte'),
    ('PEDAGIO', 'Transporte'),
    ('NETFLIX', 'Assinaturas'),
    ('SPOTIFY', 'Assinaturas'),
    ('DISNEY', 'Assinaturas'),
    ('HBO', 'Assinaturas'),
    ('YOUTUBE', 'Assinaturas'),
    ('APPLE.COM/BILL', 'Assinaturas'),
    ('AMAZON PRIME', 'Assinaturas'),
    ('GLOBOPLAY', 'Assinaturas'),
    ('STREAMING', 'Assinaturas'),
    ('FARMAC', 'Saúde'),
    ('DROGA', 'Saúde'),
    ('LABORATORIO', 'Saúde'),
    ('CLINICA', 'Saúde'),
    ('HOSPITAL', 'Saúde'),
    ('COBASI', 'Pets'),
    ('PETZ', 'Pets'),
    ('PETLOVE', 'Pets'),
    ('PET SHOP', 'Pets'),
    ('PETSHOP', 'Pets'),
    ('VETERINAR', 'Pets'),
    ('MERCADOLIVRE', 'Compras'),
    ('MERCADO LIVRE', 'Compras'),
    ('AMAZON', 'Compras'),
    ('SHOPEE', 'Compras'),
    ('MAGALU', 'Compras'),
    ('ALIEXPRESS', 'Compras'),
    ('SHEIN', 'Compras'),
    ('CINEMA', 'Lazer'),
    ('INGRESSO', 'Lazer'),
    ('STEAM', 'Lazer'),
    ('PLAYSTATION', 'Lazer'),
    ('XBOX', 'Lazer'),
    ('UDEMY', 'Educação'),
    ('ALURA', 'Educação'),
    ('LIVRARIA', 'Educação'),
    ('IOF', 'Serviços e taxas'),
    ('ANUIDADE', 'Serviços e taxas'),
    ('JUROS', 'Serviços e taxas'),
    ('MULTA', 'Serviços e taxas')
) AS r("pattern", "category")
JOIN "categories" c ON c."name" = r."category"
ON CONFLICT ("pattern") DO NOTHING;
