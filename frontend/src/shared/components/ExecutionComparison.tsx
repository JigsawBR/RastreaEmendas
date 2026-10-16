import { formatBRL, formatPct } from "../lib/format";
import { ValueBar } from "./DesignSystem";
export default function ExecutionComparison({
  committed,
  paid,
  liquidated,
  partial,
  incompleteCoverage = false,
}: {
  committed: number | null;
  paid: number | null;
  liquidated?: number | null;
  partial?: { committed: boolean; liquidated: boolean; paid: boolean };
  incompleteCoverage?: boolean;
}) {
  const max = Math.max(committed ?? 0, paid ?? 0, liquidated ?? 0, 0);
  const comparable =
    committed !== null &&
    paid !== null &&
    !partial?.committed &&
    !partial?.paid &&
    !incompleteCoverage;
  const difference = comparable ? committed - paid : null;
  const ratio = !comparable
    ? "Relação não calculável: dados ausentes ou parciais"
    : committed > 0
      ? formatPct(paid / committed) + " · relação pago / empenhado"
      : "Relação não calculável: empenhado zero";
  return (
    <section className="panel">
      <h2>Do compromisso ao pagamento</h2>
      <ValueBar
        label="Empenhado"
        value={committed}
        max={max}
        partial={partial?.committed}
      />
      {liquidated !== undefined && (
        <ValueBar
          label="Liquidado"
          value={liquidated}
          max={max}
          partial={partial?.liquidated}
        />
      )}
      <ValueBar label="Pago" value={paid} max={max} partial={partial?.paid} />
      <p className="ratio">{ratio}</p>
      <p className="muted small">
        Diferença:{" "}
        {difference === null
          ? "não calculável com dados ausentes ou parciais"
          : formatBRL(difference)}
        . Não equivale a saldo disponível ou dívida comprovada. Valores podem
        abranger restos a pagar.
        {comparable &&
          paid > committed &&
          " O pago supera o empenhado neste recorte; pagamentos podem incluir exercícios anteriores."}
      </p>
    </section>
  );
}
