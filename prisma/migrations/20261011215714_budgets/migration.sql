-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "start_month" TEXT NOT NULL,
    "amount_cents" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budgets_category_id_start_month_key" ON "budgets"("category_id", "start_month");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma cannot declare CHECK constraints.
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_amount_check" CHECK ("amount_cents" IS NULL OR "amount_cents" > 0);
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_start_month_check" CHECK ("start_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
