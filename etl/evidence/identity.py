import re
import unicodedata


def digits(value):
    return re.sub(r"\D", "", str(value or ""))


def cge(value):
    text = str(value or "").strip()
    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]
    code = digits(text)
    return code if len(code) == 8 else None


def valid_cnpj(value):
    number = digits(value)
    if len(number) != 14 or len(set(number)) == 1:
        return False
    for size, weights in [(12, [5,4,3,2,9,8,7,6,5,4,3,2]), (13, [6,5,4,3,2,9,8,7,6,5,4,3,2])]:
        remainder = sum(int(n)*w for n,w in zip(number[:size],weights)) % 11
        if int(number[size]) != (0 if remainder < 2 else 11-remainder):
            return False
    return True


def amendment_references(text):
    ascii_text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode().upper()
    return {(int(year), str(int(number))) for number, year in re.findall(
        r"\bEMENDA(?:S)?[^\d]{0,100}(\d{1,4})\s*/\s*(20\d{2})\b", ascii_text)}


def beneficiary_mentions(text):
    text = str(text or "")
    for match in re.finditer(r"(?<!\d)(?:\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\-\s]?\d{4}[.\-\s]?\d{2})(?!\d)", text):
        if valid_cnpj(match[0]):
            yield {"cnpj": digits(match[0]), "trecho": text[max(0,match.start()-180):match.end()+180]}
