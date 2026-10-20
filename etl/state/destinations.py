"""Where a state amendment's money goes, classified by modalidade de aplicacao.

The modality (digits 3-4 of the commitment note's codigoNatureza) says who
receives the money: a municipality (40-42), a private entity (50/60) or the
State itself (90/91). Only a municipal transfer identifies the beneficiary
municipality: the creditor is the city hall or a municipal fund. For a private
entity, nomeMunicipio is merely its seat (most NGOs are in Joao Pessoa and serve
elsewhere), so it is stored as the creditor's municipality and never promoted
to beneficiary. Same rule as etl.federal.classify_favorecidos.
"""

from collections import defaultdict
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import re
import unicodedata

MUNICIPAL_TRANSFER = "municipal_transfer"
DESTINATIONS = {
    "40": MUNICIPAL_TRANSFER,
    "41": MUNICIPAL_TRANSFER,
    "42": MUNICIPAL_TRANSFER,
    "50": "private_nonprofit",
    "60": "private_for_profit",
    "90": "direct_execution",
    "91": "direct_execution",
}
# Old or misspelled names found in CODATA notes, each confirmed by the
# creditor of the municipal transfers (e.g. SANTAREM is paid to the city hall
# of Joca Claudino, the municipality's current name).
ALIASES = {
    "PEDRO REGIO": "2512721",
    "SANTAREM": "2513653",
    "SERIDO": "2515401",
    "SAO DOMINGOS DE POMBAL": "2513968",
    "SAO BENTO DE POMBAL": "2513927",
    "ASSIS CHATEAUBRIAND": "2512754",
}


def municipality_key(name) -> str:
    text = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", text.upper().strip())


_CATALOG = json.loads((Path(__file__).parent.parent / "shared" / "pb_municipalities.json").read_text(encoding="utf-8"))
_BY_NAME = {municipality_key(name): code for code, name in _CATALOG} | ALIASES


def resolve_municipality(name) -> str | None:
    return _BY_NAME.get(municipality_key(name))


def modality(row: dict) -> str | None:
    code = re.sub(r"\D", "", str(row.get("codigoNatureza") or ""))
    return code[2:4] if len(code) >= 4 else None


def _amount(value) -> Decimal:
    try:
        return Decimal(str(value)) if value not in (None, "") else Decimal(0)
    except InvalidOperation:
        return Decimal(0)


def build_destinations(documents: list[dict]) -> list[dict]:
    """One row per amendment x creditor x modality with a positive net commitment.

    valorCalculado is signed (annulments are negative), so the sum is the net
    amount still committed; a fully annulled creditor is not a destination.
    """
    groups = defaultdict(list)
    for document in documents:
        if document["kind"] != "commitment" or document["link_status"] != "confirmed":
            continue
        row = document["payload"]
        creditor = str(row.get("cpfCnpj") or row.get("cnpjCpfCredor") or "").strip()
        groups[document["year"], document["amendment_number"], creditor,
               str(row.get("nomeCredor") or "").strip(), modality(row)].append(row)
    destinations = []
    for (year, number, creditor, name, mod), rows in groups.items():
        committed = sum((_amount(r.get("valorCalculado")) for r in rows), Decimal(0))
        if committed <= 0:
            continue
        # A creditor has one registered address; keep the most frequent spelling.
        names = defaultdict(int)
        for r in rows:
            names[str(r.get("nomeMunicipio") or "").strip()] += 1
        municipality = max(names, key=names.get) or None
        destinations.append(dict(
            year=year, amendment_number=number,
            creditor_document=creditor or None, creditor_name=name or None,
            application_modality=mod, destination=DESTINATIONS.get(mod, "other"),
            creditor_municipality=municipality,
            creditor_municipality_ibge=resolve_municipality(municipality),
            committed_value=committed, note_count=len(rows),
        ))
    return destinations
