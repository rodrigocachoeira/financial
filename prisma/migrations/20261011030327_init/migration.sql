-- CreateEnum
CREATE TYPE "Institution" AS ENUM ('NUBANK');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('ACCOUNT', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('PIX_SENT', 'PIX_RECEIVED', 'DEBIT_PURCHASE', 'BILL_PAYMENT', 'CARD_PURCHASE', 'CARD_PAYMENT_RECEIVED', 'OTHER');

-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('RULE', 'MANUAL');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "institution" "Institution" NOT NULL,
    "source" "Source" NOT NULL,
    "external_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "ledger_balance_cents" INTEGER,
    "ledger_balance_date" DATE,
    "transaction_count" INTEGER NOT NULL,
    "new_transaction_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "merchant_id" UUID,
    "installment_number" SMALLINT,
    "installment_total" SMALLINT,
    "category_id" UUID,
    "category_source" "CategorySource",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_institution_source_external_id_key" ON "accounts"("institution", "source", "external_id");

-- CreateIndex
CREATE INDEX "imports_account_id_period_start_idx" ON "imports"("account_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "imports_account_id_file_hash_key" ON "imports"("account_id", "file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_name_key" ON "merchants"("name");

-- CreateIndex
CREATE INDEX "merchants_category_id_idx" ON "merchants"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_category_id_date_idx" ON "transactions"("category_id", "date");

-- CreateIndex
CREATE INDEX "transactions_merchant_id_date_idx" ON "transactions"("merchant_id", "date");

-- CreateIndex
CREATE INDEX "transactions_import_id_idx" ON "transactions"("import_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_account_id_external_id_key" ON "transactions"("account_id", "external_id");

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Installments: both columns null, or 1 <= number <= total. Prisma cannot declare CHECK constraints.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_installment_check" CHECK (
    ("installment_number" IS NULL AND "installment_total" IS NULL)
    OR ("installment_number" IS NOT NULL AND "installment_total" IS NOT NULL
        AND "installment_number" >= 1 AND "installment_number" <= "installment_total")
);
