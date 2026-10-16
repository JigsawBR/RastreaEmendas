from datetime import datetime
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from sqlalchemy import create_engine, select, func

from etl.evidence import store
from etl.evidence.federal import paginated, plan_code
from etl.evidence.identity import amendment_references, beneficiary_mentions, cge, valid_cnpj
from etl.evidence.reviewed import validate_document, import_documents
from etl.evidence.siconv import candidate_codes
from etl.evidence import siconv
from etl.evidence.state import instrument_evidence, queue_evidence
from etl.shared.models import AmendmentEvidence, EvidenceImport, Emenda

AT = datetime(2026, 10, 15)
URL = "https://api.dados.pb.gov.br/api/v1/convenios/estado_municipios?ano=2024"


class EvidenceTests(unittest.TestCase):
    def test_exact_references_and_cnpj_checksum(self):
        self.assertEqual(amendment_references("EMENDA IMPOSITIVA PARLAMENTAR Nº 576/2024 (LOA 2024)"), {(2024, "576")})
        self.assertEqual(amendment_references("Convênio 576/2024"), set())
        self.assertEqual(amendment_references("emenda 0576/2025"), {(2025, "576")})
        self.assertTrue(valid_cnpj("23.367.349-0001-61"))
        self.assertFalse(valid_cnpj("23.367.349-0001-62"))
        self.assertFalse(valid_cnpj("00.000.000/0000-00"))
        self.assertEqual(len(list(beneficiary_mentions("Instituto CNPJ 23.367.349-0001-61"))), 1)
        self.assertEqual(cge("24121772.0"), cge("24-12177-2"))
        self.assertIsNone(cge("24-12177"))

    def test_instrument_requires_explicit_amendment_year_or_exact_cge_creditor(self):
        known = {(2024, "576"): {}, (2024, "799"): {}}
        note = {"kind": "commitment", "year": 2024, "amendment_number": "799", "payload": {"registroCGE": "24121772.0", "cpfCnpj": "07870719000122"}}
        agreement = {"detalheObjeto": "Emenda 576/2024", "numeroConvenio": "0025/2024", "nomeConvenente": "Instituto"}
        contract = {"registroCge": "24-12177-2", "cnpjCpf": "07.870.719/0001-22", "numeroContrato": "0565/2024", "valorTotal": 100, "urlContrato": "https://pncp.gov.br/app/contratos/example"}
        rows = instrument_evidence(known, [note], [(agreement, AT, URL)], [(contract, AT, URL), (contract, AT, URL)])
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["payload"]["papel"], "convenente")
        self.assertEqual(rows[1]["status"], "confirmed")
        self.assertEqual(rows[1]["payload"]["valorInstrumento"], 100)
        self.assertEqual(instrument_evidence(known, [note], [({**agreement, "detalheObjeto": "Emenda 576/2025"}, AT, URL)], [({**contract, "cnpjCpf": "00000000000000"}, AT, URL)]), [])

    def test_queue_never_upgrades_payment_and_rejects_partial_identity(self):
        doc = {"year": 2024, "amendment_number": "799", "payload": {"numeroDocumento": 123, "numeroEmpenho": 42, "cnpjCpfCredor": "07870719000122", "codigoFonteRecurso": "79900"}}
        row = {"numeroAp": 123, "numeroEmpenho": 42, "cnpjCpfCredor": "07870719000122", "codigoFonteRecursos": "79900", "status": "PAGO", "valorPago": 100}
        self.assertEqual(queue_evidence(doc, row, URL, AT)["status"], "candidate")
        for change in [{"numeroAp": 124}, {"cnpjCpfCredor": "***000***"}, {"codigoFonteRecursos": "50000"}]:
            self.assertIsNone(queue_evidence(doc, {**row, **change}, URL, AT))

    def test_failed_collection_preserves_cache_and_source_replacement_is_isolated(self):
        def failing():
            yield {"new": True}
            raise RuntimeError("interrupted")
        with tempfile.TemporaryDirectory() as directory, patch.object(store, "CACHE_DIR", Path(directory)):
            store.cached("test", lambda: [{"old": True}])
            with self.assertRaises(RuntimeError):
                store.cached("test", failing, refresh=True)
            self.assertEqual(store.cached("test", lambda: [])[0], [{"old": True}])
        engine = create_engine("sqlite://")
        for model in [AmendmentEvidence, EvidenceImport]:
            model.__table__.create(engine)
        def item(source, number="799"):
            return store.evidence("state", 2024, number, source, "contract", "confirmed", "Contrato", URL, AT, "CGE e CNPJ", {})
        for source in ["a", "b"]:
            store.replace_source(engine, "state", 2024, source, [item(source), item(source)], 1, AT, "test")
        store.replace_source(engine, "state", 2024, "a", [], 0, AT, "test")
        with self.assertRaises(ValueError):
            store.replace_source(engine, "state", 2024, "b", [item("wrong")], 1, AT, "test")
        with engine.connect() as c:
            self.assertEqual(c.scalar(select(func.count()).select_from(AmendmentEvidence)), 1)
            self.assertEqual(c.scalar(select(AmendmentEvidence.source)), "b")
        engine.dispose()

    def test_specials_requires_complete_pagination_and_discards_bank_fields(self):
        class Response:
            def __init__(self, body): self.body = body
            def raise_for_status(self): pass
            def json(self): return self.body
        class Session:
            def __init__(self, bodies): self.bodies = iter(bodies)
            def get(self, *args, **kwargs): return Response(next(self.bodies))
        def body(page, rows, total=2):
            return {"data": rows, "total_pages": 2, "total_items": total, "page_number": page, "page_size": 1}
        rows = list(paginated("planos-acao-especiais", {}, Session([body(1, [{"id_plano_acao": 1, "numero_conta_plano_acao": "secret"}]), body(2, [{"id_plano_acao": 2}])])))
        self.assertEqual(rows, [{"id_plano_acao": 1}, {"id_plano_acao": 2}])
        for invalid in [body(2, []), body(2, [{"id_plano_acao": 2}], 3), body(1, [{"id_plano_acao": 2}])]:
            with self.assertRaises(ValueError):
                list(paginated("planos-acao-especiais", {}, Session([body(1, [{"id_plano_acao": 1}]), invalid])))
        self.assertEqual(plan_code({"ano_emenda_parlamentar_plano_acao": 2024, "codigo_parlamentar_emenda_plano_acao": 4317, "sequencial_emenda_parlamentar_plano_acao": 8}), "202443170008")

    def test_siconv_suffix_does_not_infer_year_from_program(self):
        self.assertEqual(candidate_codes({"NR_EMENDA": "43170008", "COD_PROGRAMA_EMENDA": "1234520240001"}, {"202343170008": 2023, "202443170008": 2024, "202443170009": 2024}), {"202343170008", "202443170008"})

    def test_siconv_chain_filters_pb_and_keeps_local_values_separate(self):
        fixtures = {
            "emenda": [{"ID_PROPOSTA": "1", "NR_EMENDA": "43170008"}, {"ID_PROPOSTA": "2", "NR_EMENDA": "43170008"}],
            "proposta": [{"ID_PROPOSTA": "1", "UF_PROPONENTE": "PB", "NM_PROPONENTE": "Município", "OBJETO_PROPOSTA": "Obra"}, {"ID_PROPOSTA": "2", "UF_PROPONENTE": "PE", "NM_PROPONENTE": "Fora da PB", "OBJETO_PROPOSTA": "Outra obra"}],
            "convenio": [{"ID_PROPOSTA": "1", "NR_CONVENIO": "101", "SIT_CONVENIO": "Em execução", "NR_PROCESSO": "P1", "VL_GLOBAL_CONV": "1.000,00"}, {"ID_PROPOSTA": "2", "NR_CONVENIO": "102", "SIT_CONVENIO": "Em execução", "NR_PROCESSO": "P2"}],
            "licitacao": [{"ID_LICITACAO": "20", "NR_CONVENIO": "101"}],
            "contrato": [{"ID_LICITACAO": "20", "ID_CONTRATO": "30", "NR_CONTRATO": "1/2024", "NOME_FORNECEDOR_CONTRATO": "Empresa", "VALOR_GLOBAL_CONTRATO": "800,00"}],
            "pagamento": [{"NR_CONVENIO": "101", "NR_MOV_FIN": "40", "NOME_FORNECEDOR": "Empresa", "TP_MOV_FINANCEIRA": "PAGAMENTO", "DATA_PAG": "01/01/2025", "VL_PAGO": "200,00", "IDENTIF_FORNECEDOR": "discard"}],
            "acomp_obras_contratos_medicoes_modulo_empresas": [{"ID_PROPOSTA": "1", "ID_MEDICAO_ACOMPANHAMENTO_OBRA": "50", "SITUACAO_MEDICAO_ACOMPANHAMENTO_OBRA": "Em análise"}],
        }
        engine = create_engine("sqlite://")
        for model in [AmendmentEvidence, EvidenceImport, Emenda]: model.__table__.create(engine)
        with engine.begin() as c: c.execute(Emenda.__table__.insert(), {"codigo_emenda": "202443170008", "ano": 2024})
        with tempfile.TemporaryDirectory() as directory, patch.object(siconv, "CACHE_DIR", Path(directory)), patch.object(siconv, "csv_rows", side_effect=lambda name, **kwargs: iter(fixtures[name])):
            for name in fixtures: (Path(directory) / f"siconv_{name}.zip").touch()
            for _ in range(2): siconv.load_siconv(engine, [2024])
        with engine.connect() as c:
            rows = c.execute(select(AmendmentEvidence)).mappings().all()
            self.assertEqual(len(rows), 4)
            self.assertTrue(all(r["status"] == "candidate" for r in rows))
            paid = next(r for r in rows if r["kind"] == "local_payment")
            self.assertEqual(paid["payload"]["valorMovimento"], 200)
            self.assertNotIn("IDENTIF_FORNECEDOR", paid["payload"])
            self.assertFalse(any("Fora da PB" in json.dumps(r["payload"]) for r in rows))
        engine.dispose()

    def test_reviewed_documents_require_evidence_not_just_author_name(self):
        row = {"kind": "original_request", "title": "Ofício", "source_url": "https://example.gov.br/processo", "match_basis": "Código da emenda e exercício no ofício", "payload": {"nome": "Associação", "papel": "demandante_original", "processo": "processo-1", "documentoUrl": "https://example.gov.br/oficio.pdf", "trecho": "Demanda e emenda identificadas", "revisadoPor": "Equipe de pesquisa", "revisadoEm": "2026-10-15"}}
        self.assertEqual(validate_document(row), row)
        for payload in [{**row["payload"], "papel": "parlamentar"}, {**row["payload"], "documentoUrl": "javascript:alert(1)"}, {**row["payload"], "conta": "secret"}]:
            with self.assertRaises(ValueError): validate_document({**row, "payload": payload})
        engine = create_engine("sqlite://")
        for model in [AmendmentEvidence, EvidenceImport, Emenda]: model.__table__.create(engine)
        with engine.begin() as c: c.execute(Emenda.__table__.insert(), {"codigo_emenda": "202443170008", "ano": 2024})
        for _ in range(2): self.assertEqual(import_documents(engine, "federal", 2024, "202443170008", [row]), 1)
        with self.assertRaises(ValueError): import_documents(engine, "federal", 2025, "202443170008", [row])
        with engine.connect() as c: self.assertEqual(c.scalar(select(func.count()).select_from(AmendmentEvidence)), 1)
        engine.dispose()
