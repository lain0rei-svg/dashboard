from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
import contextlib
import io
import json

from scripts import update

PRODUCT = {
    "id": "fund", "code": "123456", "match": "测试基金-美元-累计",
    "source": "https://example.test/", "history": [],
}
HTML = """<div>基金代码：</div><span>123456</span><span>测试基金－美元－累计</span>
<h2>基金价格资料</h2><div>（截至 2025-01-03）</div><p>单位净值说明</p>
<div>基金参考价格： • 单位净值： 10.50 • 累计净值 -</div>
<div>单位净值与前一个交易日比较的升跌： +0.12%</div>"""


class UpdateTests(TestCase):
    def test_quote_and_daily(self):
        self.assertEqual(update.parse(HTML, PRODUCT, date(2025, 1, 4)),
                         ("2025-01-03", "10.50", 0.12))

    def test_wrong_identity_future_and_duplicate_rejected(self):
        for page, today in [
            (HTML.replace("123456", "999999"), date(2025, 1, 4)),
            (HTML, date(2025, 1, 2)),
            (HTML * 2, date(2025, 1, 4)),
        ]:
            with self.assertRaises(ValueError):
                update.parse(page, PRODUCT, today)

    def test_preserve_previous_observations(self):
        product = dict(PRODUCT, history=[])
        self.assertEqual(update.store_quote(product, "2025-01-03", "10.50", 0.12, "now"), "updated")
        self.assertEqual(update.store_quote(product, "2025-01-03", "10.5", 0.12, "later"), "unchanged")
        self.assertEqual(update.store_quote(product, "2025-01-02", "10.49", None, "later"), "older")
        with self.assertRaises(ValueError):
            update.store_quote(product, "2025-01-03", "10.51", 0.12, "later")
        self.assertEqual(product["history"], [dict(
            date="2025-01-03", nav="10.50", daily=0.12, retrievedAt="now", source=PRODUCT["source"]
        )])

    def test_fetch_failure_persists_status_without_losing_history(self):
        product = dict(PRODUCT, history=[])
        update.store_quote(product, "2025-01-03", "10.50", 0.12, "now")
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "data.json"
            path.write_text(json.dumps([product]))
            with patch.object(update, "DATA", path), patch.object(
                update, "urlopen", side_effect=OSError("offline")
            ), contextlib.redirect_stdout(io.StringIO()):
                self.assertTrue(update.main())
            stored = json.loads(path.read_text())[0]
        self.assertEqual(stored["state"], "error")
        self.assertTrue(stored["checkedAt"])
        self.assertEqual(stored["history"], product["history"])
