import argparse
import logging
from etl.shared.load import get_engine, init_db
from etl.shared.years import parse_years
from etl.evidence.state import load_instruments, load_payment_context
from etl.evidence.federal import load_specials
from etl.evidence.siconv import load_siconv


def main():
    parser = argparse.ArgumentParser(description="Evidências complementares de rastreabilidade")
    parser.add_argument("--years", default="2023-2026")
    parser.add_argument("--sources", default="state,specials", help="state,specials,queue,siconv (siconv baixa arquivos nacionais volumosos)")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    sources = args.sources.split(",")
    if not sources or set(sources) - {"state", "specials", "queue", "siconv"}:
        parser.error("--sources aceita state,specials,queue,siconv")
    years = parse_years(args.years)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    engine = get_engine()
    try:
        init_db(engine)
        for source, loader in [("state", load_instruments), ("specials", load_specials), ("siconv", load_siconv), ("queue", load_payment_context)]:
            if source in sources:
                loader(engine, years, refresh=args.refresh)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
