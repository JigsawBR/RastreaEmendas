"""SICONV open-data instruments and downstream execution (streamed CSV joins)."""
import argparse
import csv
from io import TextIOWrapper
import logging
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from sqlalchemy import select
from etl.federal.opendata import download_zip
from etl.shared.models import Emenda
from etl.shared.parsing import parse_brl
from etl.evidence.identity import digits
from etl.evidence.store import CACHE_DIR, evidence, replace_source

BASE = "https://api-publica.transferegov.gestao.gov.br/downloads/dadosgov"
logger = logging.getLogger(__name__)
SOURCE = "siconv_candidates"
REQUIRED = {
    "emenda": {"ID_PROPOSTA", "NR_EMENDA", "COD_PROGRAMA_EMENDA"},
    "proposta": {"ID_PROPOSTA", "UF_PROPONENTE", "NM_PROPONENTE", "OBJETO_PROPOSTA"},
    "convenio": {"ID_PROPOSTA", "NR_CONVENIO", "SIT_CONVENIO", "NR_PROCESSO"},
    "licitacao": {"ID_LICITACAO", "NR_CONVENIO"},
    "contrato": {"ID_LICITACAO", "ID_CONTRATO", "NR_CONTRATO", "NOME_FORNECEDOR_CONTRATO", "VALOR_GLOBAL_CONTRATO"},
    "pagamento": {"NR_MOV_FIN", "NR_CONVENIO", "VL_PAGO", "NOME_FORNECEDOR", "DATA_PAG", "TP_MOV_FINANCEIRA"},
    "acomp_obras_contratos_medicoes_modulo_empresas": {"ID_PROPOSTA", "ID_MEDICAO_ACOMPANHAMENTO_OBRA", "SITUACAO_MEDICAO_ACOMPANHAMENTO_OBRA"},
}


def csv_rows(name, *, refresh=False):
    csv.field_size_limit(10 * 1024 * 1024)
    path = CACHE_DIR / f"siconv_{name}.zip"
    path.parent.mkdir(parents=True, exist_ok=True)
    if refresh or not path.exists():
        logger.info("Downloading %s", path.name)
        download_zip(f"{BASE}/{path.name}", path)
    with zipfile.ZipFile(path) as archive:
        names = [n for n in archive.namelist() if n.lower().endswith(".csv")]
        if len(names) != 1:
            raise ValueError(f"CSV ambiguo no arquivo {path}")
        with archive.open(names[0]) as raw:
            wrapper = TextIOWrapper(raw, encoding="utf-8-sig", newline="")
            reader = csv.DictReader(wrapper, delimiter=";")
            if not REQUIRED[name].issubset(reader.fieldnames or []):
                raise ValueError(f"Esquema SICONV alterado: {name}")
            for row in reader:
                yield row


def candidate_codes(row, known):
    # NR_EMENDA contains eight digits and omits the budget year. A program's
    # year is not proof of the amendment's year. Keep every association a
    # candidate, including when only one loaded amendment shares that suffix.
    suffix = digits(row.get("NR_EMENDA"))
    if not suffix or len(suffix) > 8:
        return set()
    return {code for code in known if len(code) == 12 and code[4:] == suffix.zfill(8)}


def load_siconv(engine, years, *, refresh=False):
    with engine.connect() as connection:
        known = {r.codigo_emenda: r.ano for r in connection.execute(select(Emenda.codigo_emenda, Emenda.ano).where(Emenda.ano.in_(years)))}
    proposed, proposals = defaultdict(set), {}
    counts, times, found = {}, [], []
    def scan(name):
        count = 0
        logger.info("SICONV: lendo %s", name)
        for row in csv_rows(name, refresh=refresh):
            count += 1
            yield row
        counts[name] = count
        path = CACHE_DIR / f"siconv_{name}.zip"
        times.append(datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).replace(tzinfo=None))
    for row in scan("emenda"):
        proposed[row["ID_PROPOSTA"]].update(candidate_codes(row, known))
    proposed = {key: value for key, value in proposed.items() if value}
    for row in scan("proposta"):
        if row["ID_PROPOSTA"] in proposed and row["UF_PROPONENTE"].strip().upper() == "PB":
            proposals[row["ID_PROPOSTA"]] = {k: row.get(k) for k in ["ID_PROPOSTA", "NM_PROPONENTE", "MUNIC_PROPONENTE", "OBJETO_PROPOSTA", "SIT_PROPOSTA"]}
    proposed = {key: value for key, value in proposed.items() if key in proposals}
    conventions = {}
    caveat = "Vínculo candidato: NR_EMENDA no SICONV omite o exercício. O ano do programa não confirma o ano da emenda. O instrumento pode reunir várias emendas e contrapartida; valores não são atribuídos integralmente a esta emenda."
    def add(name, proposal, kind, title, payload):
        for code in proposed.get(proposal, set()):
            found.append(evidence("federal", known[code], code, SOURCE, kind, "candidate", title,
                f"{BASE}/siconv_{name}.zip", datetime.fromtimestamp((CACHE_DIR / f"siconv_{name}.zip").stat().st_mtime, timezone.utc).replace(tzinfo=None),
                "Número de 8 dígitos da emenda + ID da proposta PB; convênio/licitação/documentos por seus IDs. Exercício da emenda pendente de confirmação.",
                {"idProposta": proposal, **payload, "observacao": caveat}))
    def money(value):
        parsed = parse_brl(value)
        return float(parsed) if parsed is not None else None
    for row in scan("convenio"):
        proposal = row["ID_PROPOSTA"]
        if proposal not in proposed:
            continue
        conventions[row["NR_CONVENIO"]] = proposal
        p = proposals[proposal]
        add("convenio", proposal, "agreement", f"Convênio federal {row['NR_CONVENIO']}", {
            "numeroInstrumento": row["NR_CONVENIO"], "nome": p["NM_PROPONENTE"], "papel": "proponente_convenente", "municipio": p.get("MUNIC_PROPONENTE"),
            "objeto": p["OBJETO_PROPOSTA"], "situacao": row["SIT_CONVENIO"], "processo": row["NR_PROCESSO"], "valorInstrumento": money(row.get("VL_GLOBAL_CONV"))})
    bids = {}
    for row in scan("licitacao"):
        if row["NR_CONVENIO"] in conventions:
            bids[row["ID_LICITACAO"]] = (conventions[row["NR_CONVENIO"]], row["NR_CONVENIO"])
    for row in scan("contrato"):
        if row["ID_LICITACAO"] not in bids:
            continue
        proposal, convention = bids[row["ID_LICITACAO"]]
        add("contrato", proposal, "contract", f"Contrato federal {row['NR_CONTRATO']}", {
            "idDocumento": row["ID_CONTRATO"], "idLicitacao": row["ID_LICITACAO"], "numeroInstrumento": convention,
            "nome": row["NOME_FORNECEDOR_CONTRATO"], "papel": "contratado", "objeto": row.get("OBJETO_CONTRATO"), "valorInstrumento": money(row["VALOR_GLOBAL_CONTRATO"])})
    for row in scan("pagamento"):
        if row["NR_CONVENIO"] not in conventions:
            continue
        add("pagamento", conventions[row["NR_CONVENIO"]], "local_payment", f"Movimento local SICONV {row['NR_MOV_FIN']}", {
            "idDocumento": row["NR_MOV_FIN"], "numeroInstrumento": row["NR_CONVENIO"], "nome": row["NOME_FORNECEDOR"], "papel": "favorecido_movimento",
            "situacao": row["TP_MOV_FINANCEIRA"], "data": row["DATA_PAG"], "objeto": row.get("DESC_DL"), "valorMovimento": money(row["VL_PAGO"])})
    for row in scan("acomp_obras_contratos_medicoes_modulo_empresas"):
        if row["ID_PROPOSTA"] not in proposed:
            continue
        add("acomp_obras_contratos_medicoes_modulo_empresas", row["ID_PROPOSTA"], "measurement", f"Medição SICONV {row['ID_MEDICAO_ACOMPANHAMENTO_OBRA']}", {
            "idDocumento": row["ID_MEDICAO_ACOMPANHAMENTO_OBRA"], "situacao": row["SITUACAO_MEDICAO_ACOMPANHAMENTO_OBRA"],
            "data": row.get("DATA_FIM_MEDICAO_OBJETO_ACOMPANHAMENTO_OBRA"), "objeto": "Registro de medição de obra; situação informada não certifica entrega integral ou aprovação das contas."})
    for year in years:
        count = replace_source(engine, "federal", year, SOURCE, [r for r in found if r["year"] == year], sum(counts.values()), max(times),
            "Arquivos nacionais SICONV completos (emenda, proposta, convênio, licitação, contrato, pagamento e medições). Proponente PB e número de 8 dígitos coincidente com emendas já carregadas; exercício ainda não confirmado. Datas de coleta por arquivo em cada evidência. Valores podem cobrir várias fontes, emendas ou contrapartida.")
        logger.info("SICONV %d: %d evidencias candidatas", year, count)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspect", action="store_true")
    args = parser.parse_args()
    if args.inspect:
        for name in ["emenda", "licitacao"]:
            for row in csv_rows(name):
                print(name, list(row))
                if name == "emenda":
                    print({k: row[k] for k in ["ID_PROPOSTA", "NR_EMENDA", "COD_PROGRAMA_EMENDA"]})
                break
