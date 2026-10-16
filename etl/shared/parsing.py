from datetime import date, datetime
from decimal import Decimal


def parse_brl(value) -> Decimal | None:
    """Parse Brazilian-formatted currency strings like "100.000,00"."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    return Decimal(value.replace(".", "").replace(",", "."))


def parse_date_br(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%d/%m/%Y").date()
    except ValueError:
        # a API pode devolver "Sem informação" e outros placeholders
        return None


def _int_or_none(v):
    if v is None or v == "":
        return None
    return int(v)


def _decimal_or_none(v):
    if v is None or v == "":
        return None
    return Decimal(str(v))


def _iso_date_or_none(v):
    if not v:
        return None
    return datetime.strptime(v, "%Y-%m-%d").date()
