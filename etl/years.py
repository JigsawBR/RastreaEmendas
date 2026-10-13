"""Shared, validated year selection for the ETL entry points."""
import re


def parse_years(spec: str) -> list[int]:
    years: set[int] = set()
    for piece in spec.split(","):
        piece = piece.strip()
        if not re.fullmatch(r"\d{1,4}(?:-\d{1,4})?", piece):
            raise ValueError("Use anos ou intervalos, como 2024 ou 2023-2026.")
        bounds = [int(value) for value in piece.split("-")]
        start, end = bounds[0], bounds[-1]
        if not 1 <= start <= end <= 9999:
            raise ValueError("O período deve conter anos de 1 a 9999 em ordem crescente.")
        years.update(range(start, end + 1))
    return sorted(years)
