"""Resume o teste de usabilidade: sucesso, tempo e facilidade por tarefa, e SUS.

Uso: python docs/teste-usabilidade/analisar.py [resultados.csv] [sus.csv]
Sem argumentos, lê os dois arquivos desta pasta. Separador: ponto e vírgula.
"""

import csv
import statistics
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
SUCCESS = {"completo": 1.0, "parcial": 0.5, "falha": 0.0}
# Médias da escala de adjetivos de Bangor, Kortum e Miller (2009), usadas como cortes.
ADJECTIVES = [(85.5, "excelente"), (71.4, "bom"), (50.9, "ok"), (35.7, "ruim"), (0.0, "péssimo")]


def read(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return [row for row in csv.DictReader(handle, delimiter=";") if any((v or "").strip() for v in row.values())]


def number(row: dict, field: str, line: int, low: float, high: float) -> float:
    try:
        value = float(str(row[field]).replace(",", "."))
    except (TypeError, ValueError):
        raise SystemExit(f"Linha {line}: '{field}' precisa ser um número (recebido: {row.get(field)!r})")
    if not low <= value <= high:
        raise SystemExit(f"Linha {line}: '{field}' deve estar entre {low:g} e {high:g} (recebido: {value:g})")
    return value


def sus_score(answers: list[float]) -> float:
    """Itens ímpares valem resposta − 1; pares, 5 − resposta; a soma × 2,5 vai de 0 a 100."""
    return 2.5 * sum(a - 1 if i % 2 == 0 else 5 - a for i, a in enumerate(answers))


def adjective(score: float) -> str:
    return next(label for cut, label in ADJECTIVES if score >= cut)


def summarize_tasks(rows: list[dict]) -> list[dict]:
    tasks = defaultdict(list)
    for line, row in enumerate(rows, start=2):
        status = (row.get("sucesso") or "").strip().lower()
        if status not in SUCCESS:
            raise SystemExit(f"Linha {line}: 'sucesso' deve ser completo, parcial ou falha (recebido: {status!r})")
        tasks[row["tarefa"].strip().upper()].append({
            "success": SUCCESS[status],
            "time": number(row, "tempo_s", line, 0, 3600),
            "helps": int(number(row, "ajudas", line, 0, 99)),
            "ease": number(row, "facilidade", line, 1, 7),
        })
    return [{
        "task": task, "n": len(items),
        "success": statistics.mean(i["success"] for i in items),
        "median_time": statistics.median(i["time"] for i in items),
        "helps": sum(i["helps"] for i in items),
        "ease": statistics.mean(i["ease"] for i in items),
    } for task, items in sorted(tasks.items(), key=lambda kv: (len(kv[0]), kv[0]))]


def summarize_sus(rows: list[dict]) -> tuple[dict[str, float], dict]:
    scores = {}
    for line, row in enumerate(rows, start=2):
        answers = [number(row, f"q{i}", line, 1, 5) for i in range(1, 11)]
        if any(a != int(a) for a in answers):
            raise SystemExit(f"Linha {line}: as respostas do SUS devem ser inteiras de 1 a 5")
        scores[row["participante"].strip()] = sus_score(answers)
    values = list(scores.values())
    stats = {
        "n": len(values),
        "mean": statistics.mean(values) if values else None,
        "sd": statistics.stdev(values) if len(values) > 1 else None,
        "min": min(values, default=None), "max": max(values, default=None),
    }
    return scores, stats


def main() -> None:
    results = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "resultados.csv"
    sus = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "sus.csv"
    fmt = lambda value, digits=1: f"{value:.{digits}f}".replace(".", ",")

    tasks = summarize_tasks(read(results))
    print("Tarefas")
    if not tasks:
        print("  (sem registros em resultados.csv)")
    for t in tasks:
        print(f"  {t['task']:<4} n={t['n']}  sucesso {fmt(100 * t['success'], 0)}%  "
              f"tempo mediano {fmt(t['median_time'], 0)} s  ajudas {t['helps']}  facilidade {fmt(t['ease'])}/7")
    if tasks:
        overall = statistics.mean(t["success"] for t in tasks)
        print(f"  Sucesso médio entre as tarefas: {fmt(100 * overall, 0)}% (parcial conta como meio sucesso)")

    scores, stats = summarize_sus(read(sus))
    print("\nSUS")
    if not scores:
        print("  (sem registros em sus.csv)")
        return
    for participant, score in scores.items():
        print(f"  {participant:<4} {fmt(score)}  ({adjective(score)})")
    sd = f" · desvio-padrão {fmt(stats['sd'])}" if stats["sd"] is not None else ""
    print(f"  Média {fmt(stats['mean'])} ({adjective(stats['mean'])}){sd} · "
          f"mín. {fmt(stats['min'])} · máx. {fmt(stats['max'])} · n={stats['n']}")
    print("  Referência: média da literatura = 68 (Sauro, 2011).")


if __name__ == "__main__":
    main()
