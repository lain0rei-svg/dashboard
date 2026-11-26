"""Fetch validated public HSBC quotes. Preserve archived observations."""
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.request import urlopen

DATA = Path(__file__).resolve().parents[1] / "site/data.json"


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = False

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden = True

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.hidden = False

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def parse(html, product, today):
    parser = VisibleText()
    parser.feed(html)
    text = re.sub(r"\s+", "", "".join(parser.parts)).replace("：", ":")
    text = text.replace("－", "-").replace("–", "-")
    identity = rf"基金代码:{re.escape(product['code'])}{re.escape(product['match'])}"
    if not re.search(identity, text):
        raise ValueError("Product identity mismatch")
    quotes = re.findall(
        r"基金价格资料[（(]截至(\d{4}-\d{2}-\d{2})[）)].{0,500}?"
        r"基金参考价格:.{0,10}?单位净值:(\d+(?:\.\d+)?)累计净值",
        text,
    )
    if len(quotes) != 1:
        # Some versions insert a bullet before the cumulative NAV label.
        quotes = re.findall(
            r"基金价格资料[（(]截至(\d{4}-\d{2}-\d{2})[）)].{0,500}?"
            r"基金参考价格:[•·]*单位净值:(\d+(?:\.\d+)?)[•·]*累计净值",
            text,
        )
    if len(quotes) != 1:
        raise ValueError("Expected exactly one quote")
    day, nav = quotes[0]
    if not date(1990, 1, 1) <= date.fromisoformat(day) <= today or Decimal(nav) <= 0:
        raise ValueError("Invalid quote")
    daily = re.search(r"单位净值与前一个交易日比较的升跌:([+-]?\d+(?:\.\d+)?)%", text)
    return day, nav, float(daily[1]) if daily else None


def store_quote(product, day, nav, daily, now):
    latest = product["history"][-1] if product["history"] else None
    if latest and day < latest["date"]:
        return "older"
    if latest and day == latest["date"]:
        if Decimal(nav) != Decimal(latest["nav"]):
            raise ValueError("Same-day quote differs from archive")
        return "unchanged"
    product["history"].append(dict(
        date=day, nav=nav, daily=daily, source=product["source"], retrievedAt=now,
    ))
    return "updated"


def main():
    products = json.loads(DATA.read_text())
    now = datetime.now(timezone.utc)
    stamp = now.isoformat(timespec="seconds")
    failures = 0
    for product in products:
        if not product["match"]:
            continue
        try:
            with urlopen(product["source"], timeout=25) as response:
                if response.geturl().split("?")[0] != product["source"].split("?")[0]:
                    raise ValueError("Unexpected redirect")
                content = response.read(4_000_001)
                if len(content) > 4_000_000:
                    raise ValueError("Response too large")
                html = content.decode(response.headers.get_content_charset() or "utf-8-sig")
            args = parse(html, product, (now + timedelta(hours=8)).date())
            product["state"] = store_quote(product, *args, stamp)
        except (OSError, ValueError, LookupError) as error:
            print(f"{product['id']}: {error}")
            product["state"] = "error"
            failures += 1
        product["checkedAt"] = stamp
        print(product["id"], product["state"])
    temporary = DATA.with_suffix(".tmp")
    temporary.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(DATA)
    return failures > 0


if __name__ == "__main__":
    raise SystemExit(main())
