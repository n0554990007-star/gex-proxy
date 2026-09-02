// ============================================================
// GEX PROXY SERVER
// يستقبل الطلبات من صفحة الويب، يتصل بـ Polygon.io بمفتاح
// محفوظ على السيرفر (مو ظاهر أبداً للمتصفح)، ويرجّع النتيجة.
// ============================================================

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); // يسمح لأي صفحة تتصل بالسيرفر (يمديك تقيّده لاحقاً لدومينك بس)

const PORT = process.env.PORT || 3000;
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

if (!POLYGON_API_KEY) {
  console.error("خطأ: لازم تحط POLYGON_API_KEY كمتغير بيئة (Environment Variable).");
  process.exit(1);
}

// ------------------------------------------------------------
// GET /api/price/:symbol
// ------------------------------------------------------------
app.get("/api/price/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();

  try {
    const url = `https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${POLYGON_API_KEY}`;
    const r = await fetch(url);

    if (!r.ok) {
      return res.status(r.status).json({ error: `فشل جلب السعر (${r.status})` });
    }

    const data = await r.json();
    const price = data && data.results && data.results.p;

    if (price === undefined || price === null) {
      return res.status(502).json({ error: "لم يُرجع السعر بيانات صالحة" });
    }

    res.json({ symbol, price: parseFloat(price) });
  } catch (err) {
    res.status(500).json({ error: err.message || "خطأ غير متوقع" });
  }
});

// ------------------------------------------------------------
// GET /api/options/:symbol
// يجمع كل صفحات الـ options chain (pagination) ويرجعها دفعة وحدة
// ------------------------------------------------------------
app.get("/api/options/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();

  try {
    let url = `https://api.polygon.io/v3/snapshot/options/${symbol}`;
    let params = new URLSearchParams({
      apiKey: POLYGON_API_KEY,
      limit: "250",
      sort: "strike_price",
      order: "asc",
    });

    let all = [];
    let guard = 0;

    while (guard < 40) {
      guard++;
      const r = await fetch(`${url}?${params.toString()}`);

      if (!r.ok) {
        return res.status(r.status).json({ error: `فشل جلب Options (${r.status})` });
      }

      const data = await r.json();
      const results = data.results || [];
      all = all.concat(results);

      if (!data.next_url) break;

      const nextUrl = new URL(data.next_url);
      url = nextUrl.origin + nextUrl.pathname;
      params = new URLSearchParams(nextUrl.search);
      params.set("apiKey", POLYGON_API_KEY);
    }

    res.json({ symbol, results: all });
  } catch (err) {
    res.status(500).json({ error: err.message || "خطأ غير متوقع" });
  }
});

// ------------------------------------------------------------
// فحص سريع إن السيرفر شغال
// ------------------------------------------------------------
app.get("/", (req, res) => {
  res.send("GEX proxy server is running.");
});

app.listen(PORT, () => {
  console.log(`GEX proxy listening on port ${PORT}`);
});
