import unittest
from etl.shared.years import parse_years


class YearSelectionTests(unittest.TestCase):
    def test_combines_ranges_and_removes_duplicates(self):
        self.assertEqual(parse_years("2023-2025, 2024,2026"), [2023,2024,2025,2026])

    def test_rejects_invalid_or_inverted_periods(self):
        for value in ["", "2026-2023", "2024,", "abc", "0", "10000"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_years(value)
