import { merchantFromDescription, repairMojibake } from "@/lib/ofx";
import type { PrismaClient } from "../prisma";

/**
 * Fixes transactions stored while the reader took Nubank's UTF-8 card statements for
 * windows-1252 ("Ajuste a crÃ©dito"). The description is restored and the merchant is derived
 * again from it; a merchant that existed only because of the misreading hands its category over
 * and is removed. Returns how many transactions were fixed. Running it again changes nothing.
 */
export function repairEncoding(db: PrismaClient): Promise<number> {
  return db.$transaction(async (tx) => {
    // Every misread accent starts with one of these two characters.
    const suspects = await tx.transaction.findMany({
      where: { OR: [{ description: { contains: "Ã" } }, { description: { contains: "Â" } }] },
      select: {
        id: true,
        description: true,
        kind: true,
        installmentNumber: true,
        installmentTotal: true,
        merchant: { select: { id: true, categoryId: true } },
      },
    });

    let fixed = 0;
    const replaced = new Set<string>();

    for (const transaction of suspects) {
      const description = repairMojibake(transaction.description);
      if (description === transaction.description) {
        continue;
      }
      const installment =
        transaction.installmentNumber !== null && transaction.installmentTotal !== null
          ? { number: transaction.installmentNumber, total: transaction.installmentTotal }
          : null;
      const name = merchantFromDescription(transaction.kind, description, installment);
      const previous = transaction.merchant;

      let merchantId: string | null = null;
      if (name) {
        const merchant = await tx.merchant.upsert({ where: { name }, create: { name }, update: {} });
        merchantId = merchant.id;
        // What the user taught the misnamed merchant belongs to the real one.
        if (previous?.categoryId && !merchant.categoryId) {
          await tx.merchant.update({ where: { id: merchant.id }, data: { categoryId: previous.categoryId } });
        }
      }
      if (previous && previous.id !== merchantId) {
        replaced.add(previous.id);
      }

      await tx.transaction.update({ where: { id: transaction.id }, data: { description, merchantId } });
      fixed += 1;
    }

    if (replaced.size > 0) {
      await tx.merchant.deleteMany({ where: { id: { in: [...replaced] }, transactions: { none: {} } } });
    }
    return fixed;
  });
}
