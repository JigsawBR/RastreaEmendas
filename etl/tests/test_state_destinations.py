from decimal import Decimal
import unittest

from etl.state.destinations import build_destinations, modality, resolve_municipality


def commitment(value, nature="33404100", municipality="ARACAGI", creditor="08778029000100",
               name="PREFEITURA MUNICIPAL DE ARACAGI", number="186", kind="commitment", status="confirmed", **extra):
    payload = dict(valorCalculado=value, codigoNatureza=nature, nomeMunicipio=municipality,
                   cpfCnpj=creditor, nomeCredor=name, **extra)
    return dict(year=2024, amendment_number=number, kind=kind, link_status=status, payload=payload)


class StateDestinationTests(unittest.TestCase):
    def test_municipal_transfer_identifies_the_beneficiary_municipality(self):
        [row] = build_destinations([commitment(300000), commitment("200000.50")])
        self.assertEqual(row["destination"], "municipal_transfer")
        self.assertEqual(row["application_modality"], "40")
        self.assertEqual(row["creditor_municipality_ibge"], "2500809")
        self.assertEqual(row["committed_value"], Decimal("500000.50"))
        self.assertEqual(row["note_count"], 2)

    def test_private_entity_keeps_only_its_seat(self):
        [row] = build_destinations([commitment(1000, nature="33504300", municipality="JOAO PESSOA",
                                               creditor="03303706000110", name="CASA DA DIVINA MISERICORDIA")])
        self.assertEqual(row["destination"], "private_nonprofit")
        # Stored as the creditor's address; the API must not treat it as beneficiary.
        self.assertEqual(row["creditor_municipality_ibge"], "2507507")

    def test_annulments_are_netted_and_full_annulment_is_not_a_destination(self):
        rows = build_destinations([
            commitment(500000), commitment(-500000, descricaoTipo="ANULAÇÃO TOTAL"),
            commitment(100000, number="187"), commitment(-40000, number="187"),
        ])
        self.assertEqual([(r["amendment_number"], r["committed_value"]) for r in rows], [("187", Decimal(60000))])

    def test_only_confirmed_commitments_are_used(self):
        self.assertEqual(build_destinations([commitment(1, kind="liquidation"), commitment(1, status="candidate")]), [])

    def test_creditors_and_modalities_are_separate_rows(self):
        rows = build_destinations([commitment(10), commitment(20, nature="33904000", creditor="1", name="EMPRESA")])
        self.assertEqual(sorted(r["destination"] for r in rows), ["direct_execution", "municipal_transfer"])

    def test_names_resolve_without_accents_and_through_confirmed_aliases(self):
        self.assertEqual(resolve_municipality("  joão   pessoa "), "2507507")
        self.assertEqual(resolve_municipality("MAE D'AGUA"), "2508703")
        self.assertEqual(resolve_municipality("SANTAREM"), "2513653")
        self.assertEqual(resolve_municipality("PEDRO REGIO"), "2512721")
        self.assertEqual(resolve_municipality("ASSIS CHATEAUBRIAND"), "2512754")
        self.assertIsNone(resolve_municipality("CIDADE INEXISTENTE"))
        self.assertIsNone(resolve_municipality(None))

    def test_unknown_modality_is_other(self):
        self.assertIsNone(modality({"codigoNatureza": None}))
        [row] = build_destinations([commitment(1, nature="33714100")])
        self.assertEqual(row["destination"], "other")


if __name__ == "__main__":
    unittest.main()
