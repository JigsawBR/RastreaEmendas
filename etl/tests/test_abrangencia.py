from decimal import Decimal
import unittest

import pandas as pd

from etl.federal.abrangencia import emendas_nacionais, esfera, is_multiplo_na_uf, multiplo_na_uf
from etl.federal.load_nacionais import build_rows


def linha(codigo, localidade, uf, funcao="Saúde", subfuncao="Atenção básica", ano="2025", empenhado="100,00", pago="0,00"):
    return {
        "Código da Emenda": codigo, "Ano da Emenda": ano, "Tipo de Emenda": "Emenda de Comissão",
        "Nome do Autor da Emenda": "COM. DA SAUDE", "Número da emenda": "0001",
        "Localidade de aplicação do recurso": localidade, "UF": uf,
        "Nome Função": funcao, "Nome Subfunção": subfuncao,
        "Valor Empenhado": empenhado, "Valor Pago": pago,
    }


def api(codigo, localidade="MÚLTIPLO", funcao="Saúde", subfuncao="Atenção básica"):
    return {"codigoEmenda": codigo, "localidadeDoGasto": localidade, "funcao": funcao, "subfuncao": subfuncao}


class MultiploNaUfTests(unittest.TestCase):
    def test_multiplo_applied_only_in_the_state_is_a_state_amendment(self):
        keys = multiplo_na_uf(pd.DataFrame([linha("1", "MÚLTIPLO", "PARAÍBA")]), "PARAÍBA")
        self.assertTrue(is_multiplo_na_uf(api("1"), keys))

    def test_multiplo_in_another_state_or_in_several_states_stays_out(self):
        keys = multiplo_na_uf(pd.DataFrame([
            linha("2", "MÚLTIPLO", "PERNAMBUCO"), linha("3", "MÚLTIPLO", "Múltiplo"),
        ]), "PARAÍBA")
        self.assertEqual(keys, set())

    def test_a_key_that_also_appears_outside_the_state_is_ambiguous(self):
        keys = multiplo_na_uf(pd.DataFrame([
            linha("4", "MÚLTIPLO", "PARAÍBA"), linha("4", "MÚLTIPLO", "BAHIA"),
        ]), "PARAÍBA")
        self.assertEqual(keys, set())

    def test_match_follows_the_api_grain(self):
        keys = multiplo_na_uf(pd.DataFrame([linha("5", "MÚLTIPLO", "PARAÍBA")]), "PARAÍBA")
        self.assertFalse(is_multiplo_na_uf(api("5", funcao="Educação"), keys))
        self.assertFalse(is_multiplo_na_uf(api("5", localidade="Nacional"), keys))


class EmendasNacionaisTests(unittest.TestCase):
    def test_national_amendment_totals_cover_every_state(self):
        result = emendas_nacionais(pd.DataFrame([
            linha("10", "Nacional", "Sem informação", empenhado="1.000,50"),
            linha("10", "SÃO PAULO (UF)", "SÃO PAULO", empenhado="99,50", pago="10,00"),
            linha("11", "MÚLTIPLO", "PARAÍBA"),
            linha("12", "Nacional", "Sem informação", ano="2022"),
        ]), {2025})
        self.assertEqual(list(result), ["10"])
        self.assertEqual(result["10"]["valor_empenhado_total"], Decimal("1100.00"))
        self.assertEqual(result["10"]["localidades"], "Nacional, SÃO PAULO (UF)")

    def test_sphere_comes_from_the_legal_nature(self):
        self.assertEqual(esfera("Fundo Público da Administração Direta Municipal"), "municipal")
        self.assertEqual(esfera("Município"), "municipal")
        self.assertEqual(esfera("Estado ou Distrito Federal"), "estadual")
        self.assertEqual(esfera("Associação Privada"), "privado")
        self.assertEqual(esfera(None), "privado")

    def test_only_amendments_reaching_a_public_entity_are_kept(self):
        candidatas = {c: {"codigo_emenda": c, "ano": 2025} for c in ("20", "21")}
        emendas, destinos = build_rows(candidatas, [
            ("20", "08778029000100", "MUNICIPIO DE ARACAGI", "Município", "ARAÇAGI", 500),
            ("20", "03303706000110", "FORNECEDOR LTDA", "Sociedade Empresária Limitada", "JOÃO PESSOA", 70),
            ("21", "03303706000110", "FORNECEDOR LTDA", "Sociedade Empresária Limitada", "JOÃO PESSOA", 90),
        ])
        self.assertEqual([e["codigo_emenda"] for e in emendas], ["20"])
        self.assertEqual([(d["esfera"], d["codigo_ibge"]) for d in destinos], [("municipal", "2500809"), ("privado", "2507507")])


if __name__ == "__main__":
    unittest.main()
