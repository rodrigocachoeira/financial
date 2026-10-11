"use client";

import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { CheckIcon, CopyIcon, ExternalLinkIcon, SparklesIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { buttonGhost, buttonPrimary, buttonSecondary, card } from "@/components/ui";

const CLAUDE_URL = "https://claude.ai/new";

interface Props {
  /** The full text to paste into Claude; null when the month has nothing to analyze. */
  prompt: string | null;
  monthName: string;
}

/**
 * Tips from an AI without sending anything by itself: it prepares the text, the user copies it
 * and pastes it into their own conversation with Claude. The text is never put in a URL.
 */
export function InsightsCard({ prompt, monthName }: Props) {
  const [previewing, setPreviewing] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function copy() {
    if (!prompt) {
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast({ ok: true, message: "Copiado. Cole em uma conversa no Claude." });
    } catch {
      // No clipboard access (permission denied or an insecure page): show the text to copy by hand.
      setPreviewing(true);
      toast({ ok: false, message: "Não foi possível copiar sozinho. Selecione o texto e copie." });
    }
  }

  return (
    <section className={`${card} flex flex-col gap-4 border-accent/30 bg-gradient-to-br from-accent-soft/60 to-surface p-4 sm:p-5`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-xl text-accent-foreground shadow-md shadow-accent/30">
          <SparklesIcon />
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight">Dicas com IA</h2>
          <p className="mt-0.5 text-sm text-muted">
            {prompt
              ? `Copie um resumo de ${monthName} e cole em uma conversa no Claude para receber dicas. Vão só totais e nomes de lojas; nenhum nome de pessoa, documento ou transação individual.`
              : `Não há gastos em ${monthName} para analisar.`}
          </p>
        </div>
      </div>

      {prompt && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copy} className={buttonPrimary}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copiado" : "Copiar para o Claude"}
          </button>
          <a href={CLAUDE_URL} target="_blank" rel="noopener noreferrer" className={buttonSecondary}>
            Abrir o Claude
            <ExternalLinkIcon />
          </a>
          <button type="button" onClick={() => setPreviewing(true)} className={buttonGhost}>
            Ver o que será copiado
          </button>
        </div>
      )}

      <p className="text-xs text-muted">
        O aplicativo não envia nada: você cola o texto na sua própria conta. As respostas são sugestões de uma IA, não
        recomendação financeira profissional.
      </p>

      <Dialog open={previewing} onClose={() => setPreviewing(false)} title="O que será copiado">
        <p className="text-sm text-muted">Este é o texto completo. Nada além dele sai do aplicativo.</p>
        <pre
          tabIndex={0}
          className="max-h-[50dvh] select-all overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed [scrollbar-width:thin]"
        >
          {prompt}
        </pre>
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonSecondary} onClick={() => setPreviewing(false)}>
            Fechar
          </button>
          <button type="button" className={buttonPrimary} onClick={copy}>
            <CopyIcon />
            Copiar
          </button>
        </div>
      </Dialog>
    </section>
  );
}
