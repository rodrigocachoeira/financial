import { describe, expect, it } from "vitest";
import { repairMojibake } from "./mojibake";

/** What the old decoder produced: UTF-8 bytes read as windows-1252. */
const misread = (text: string) => new TextDecoder("windows-1252").decode(new TextEncoder().encode(text));

describe("repairMojibake", () => {
  it("repairs the case seen in a real statement", () => {
    expect(misread("Ajuste a crédito")).toBe("Ajuste a crÃ©dito");
    expect(repairMojibake("Ajuste a crÃ©dito")).toBe("Ajuste a crédito");
  });

  it.each([
    "São João",
    "Açaí da Praça",
    "FARMÁCIA SÃO JOSÉ",
    "ÍNDICE Único Ônibus",
    "Estorno de “Loja” – 50% €",
    "pão, maçã, coração, ações",
  ])("restores %j", (original) => {
    expect(repairMojibake(misread(original))).toBe(original);
  });

  it.each(["Supermercado Exemplo", "MP *LOJAEXEMPLO - Parcela 2/10", "", "IOF de \"Loja\""])(
    "leaves plain text %j alone",
    (text) => {
      expect(repairMojibake(text)).toBe(text);
    },
  );

  it.each(["PÃO DE AÇÚCAR", "São João", "crédito", "Ã", "AÇÃO", "R$ 10 ©", "日本語", "Café ☕"])(
    "leaves correct text %j alone",
    (text) => {
      expect(repairMojibake(text)).toBe(text);
    },
  );

  it("changes nothing when applied twice", () => {
    const repaired = repairMojibake(misread("Transferência recebida"));
    expect(repaired).toBe("Transferência recebida");
    expect(repairMojibake(repaired)).toBe(repaired);
  });
});
