# Amazon Seller Operations Toolbox

A curated set of **free, browser-based calculators and decision tools for Amazon sellers**. Open a page and use it — **no install, no sign-up, no cost**.

> Live demo: <https://gavin-huang-maker.github.io/AMZ/>

## What it is

Amazon Seller Central data is often hard to read at a glance: how do I climb a category rank? How long until I pass the #1? Is my ad ROI actually worth it? How much profit is really left?

This project turns those high-frequency operating decisions into **independent web calculators**: type in a few numbers and get an answer. Everything runs in the browser, works on mobile, and is ready to use wherever you are.

It currently ships **35 tools** across 9 categories. Eight of them are **category-specific** tools for our winter/snow and heated-apparel line — a live snow dashboard with real-time weather, a WeCom-pushable ops console, and a full heated-product content → ads → returns pipeline.

### Category-specific · Snow & Heated Gear

| Tool | What it does |
| --- | --- |
| Ops Command Console | Pick a content template (daily brief / snowfall alert / frost reminder / ad playbook / listing self-check / post-snow review) + send time and recipients to generate an instruction ready for an AI agent to execute; wired to a scheduled task that pulls weather, builds the brief, and pushes it to WeCom. |
| Snow Season Live Dashboard | On open, fetches 14-day snowfall & temperature for 35 EU/US cities, weights them into a 0–100 "demand pulse index", and outputs phase (prep / imminent / surge / fade), countdown, daily ad budget, pre-snow timeline (D-7/D-3/D-1/D0/D+2), frost-day reminders, and an 8-item listing self-check. |
| Heated Gear Parametric Profit Tool | Breaks down real cost by battery mAh / cell price / heating element / thermostat / certification amortization / bonded first-leg / high-return rate, computes allowable CPA and break-even units, and ranks margin curves by battery-life tier. |
| Heated Demand-Word Radar | Three-channel word harvesting (Reddit discussions + search suggestions + manual TikTok/IG paste), auto-tags scene/audience/body-part/pain, one-click exportable ad word packs, daily new-word comparison. |
| Heated Expression Matrix | Turns the word radar's audience × pain into titles, bullets, A+, QA, and video hooks with EN/DE bilingual templates, each sentence auto-scanned against efficacy-claim red lines (incl. Germany's HWG rules). |
| Heated Ad Structure & Bidder | Reverse-engineers budgets and bid ranges for Auto/Exact/Broad/SD from allowable CPA, with a 19:00–23:00 prime-time dayparting strategy and a Q4 gifting-season plan. |
| Return & Bad-Review Attributor | Auto-buckets raw return reasons into 8 heated-category root causes (battery life / heating / size / cabling / workmanship / washing / expectation gap / mispurchase), prioritizes by share × fix difficulty, and estimates return-rate reduction. |
| Powered-Product Compliance Checklist | 20-item US self-check: UL/ETL, battery certification, FCC, UN38.3 & lithium shipping, Prop 65, Amazon powered-review, FDA medical-claim red lines — with fee ranges, critical-path timelines, per-unit amortization, and auto-saved progress. |

### MCP Tools

| Tool | What it does |
| --- | --- |
| MCP Research Studio Debugger | Paste an MCP server URL (`URL` + `Authorization: Bearer <token>`) to connect, list its tools/resources, and try each call — no client code required. In-page `mcp-studio/` manual covers field formats, Streamable HTTP vs SSE, a 401/404/405/CORS self-check table, a `mcp.json` config snippet, and token safety. |

### Core · Pinned

| Tool | What it does |
| --- | --- |
| ABA Rank Analysis (12-week trend report) | Drop in batches of "Top Search Terms" weekly reports; DuckDB-WASM runs real SQL into an Apollo-style report: rank-trend lines (log axis, per-word selectable), week-over-week movers, share-of-shelf, word × week heat matrix, plus a sortable/exportable detail table and a **one-click 4-page A4 PDF** (Canvas layout + hand-rolled PDF container, no print dialog, with ring/bar charts, detail table, ad suggestions, and methodology notes). Leave ASIN blank = full analysis; add competitor ASINs = reverse-lookup "shoppers searching who also clicked these competitors", optional Jev scoring. |

### Traffic & Conversion

| Tool | What it does |
| --- | --- |
| Traffic Funnel Diagnostics | Layer-by-layer check of impressions → sessions → views → cart → orders, splitting period-over-period drops into "traffic contribution" vs "conversion contribution". |
| Keyword Traffic-Gap Map | Per-word traffic share → how much more you'd earn by ranking it, and payback time, ranked by attack priority. |
| Listing Conversion Gap Tree | Scores/reviews/price/promo/content/fulfillment benchmarked against category averages, sorted by "most valuable to fix + time to effect". |
| Price-Band × Rating Blue-Ocean Locator | Competitor grid heatmap using a scarcity index to find the cell "few competitors, yet everyone profits". |
| Competitor Review Health Check | Median + MAD robust stats surface anomalous spikes; strips the noise to compute true organic growth and catch-up time. |
| ABA Category Snapshot | Upload "Top Search Terms" reports (multi-week / multi-file accumulative); local category report: intent structure, brand & ASIN share, hype vs efficient words; ≥4 weeks auto-adds seasonality rhythm and windows; downloadable standalone HTML. Zero network requests. |
| Desktop Studio | A small Windows local utility: desktop wallpaper rotation, 3-zone pinned launcher, and 5-category file archiving with undo. The page only offers download & docs; the app is offline and stores config locally. |

### Ads

| Tool | What it does |
| --- | --- |
| Search-Term Report Dissector | Chinese headers supported; dedup + root clustering; outputs negative / scale-up / bid-control lists, exportable. |
| Ad Structure Health & Budget Realloc | Finds campaigns to fund / cut / that can't spend, detects duplicate targeting, and gives a concrete daily budget for each. |
| Ad Incrementality Detector | Regression + control-group methods compute true incrementality ratio and true ACOS; break-even incrementality answers "should I cut the budget?". |

### Rank · Selection · Launch

| Tool | What it does |
| --- | --- |
| BSR Overtake Calculator Pro | Top 1/3/5/10 × three sprint rhythms, power-law threshold + weighted rolling-window model; plus YoY market diagnosis (λ / η). |
| New-Product Launch Success Sim | Multiple budget tiers compute feasibility, days-to-rank, days-to-payback, and auto-picks "the cheapest tier that hits target". |
| Category Attractiveness × Entry-Difficulty Matrix | Two-axis scoring into a four-quadrant scatter, with launch capital and payback cycle. |

### Profit & Cost

| Tool | What it does |
| --- | --- |
| Profit & Ad-Affordability Calculator | Per-unit margin (incl. return/scrap loss), break-even CPA/ACOS, allowable CPA; combined with rank threshold to compute positioning budget and payback days. |
| Full-Cost Fulfillment Comparison | FBA / overseas warehouse / self-ship head-to-head, factoring in how fulfillment choice affects conversion. |
| FX & Payment-Term Impact on Real Margin | Converts FX volatility and capital occupation into "equivalent points of margin lost" and judges whether FX management is worth it. |
| Listing ROI & Competitor Benchmark | Monthly net profit / ROI / net margin / break-even ACOS, price, and units for your listing; then benchmarks against BSR 1–3, 10–20, ~30, ~50 competitors, uses a rank–sales power-law to extrapolate units needed to climb, overlays 12-month category traffic trend, and tells whether you're gaining or losing share. |

### Inventory & Cash

| Tool | What it does |
| --- | --- |
| Inventory & Replenishment Alert | Days of cover, latest order date, fast vs slow line comparison, and "cost of delaying one day". |
| Stockout Loss & Recovery Cost | How many ranks you lose on stockout, how many days/money to recover, converted to concrete amounts. |
| Excess Inventory Disposal Decision | Continue selling / discount liquidation / dispose / remove-and-transfer — landed-cash comparison + delay cost. |
| Multi-Variant P&L Matrix | Paste variant data from Excel; flags which to push / cut and computes freed inventory capital and ad budget. |

### Cadence & Risk

| Tool | What it does |
| --- | --- |
| Seasonality Denoise & Entry-Window Calendar | Centralized moving average strips seasonality to reveal true growth; outputs seasonality index and a stocking/ad cadence. |
| Promo Cadence & Budget Planner | Preheat / surge / recovery single-unit curves with discount and ad budget together; three intensity tiers + stockout check. |
| Account Health Red-Line Alert | Five metrics converted to "how far from the red line", with a health score and prioritized action list. |

**Recommended decision loop**

```
BSR Calculator Pro  →  how many units/day (U*, days, rhythm)
        ↓ feed U* into
Profit Calculator   →  daily spend, allowable CPA, payback days
        ↓ before executing
Stockout + Red-Line →  confirm you can absorb it
```

First confirm "can I climb?" with the BSR tool, then "is it worth it?" with the profit tool, then "can I survive if it breaks?" with the risk tools.

## Online use

Just open the live demo link above — no local deployment needed.

If you fork this repo to your own account, **GitHub Pages** or **Netlify** both deploy it free in a few minutes.

## Deploy to your own site

**Option 1 — Netlify (fastest, ~30s)**
1. Open <https://app.netlify.com/drop>
2. Drag the folder containing `index.html` in
3. Done — you get `https://xxxxxx.netlify.app`

**Option 2 — GitHub Pages (stable, long-term)**
1. Repo Settings → Pages
2. Source: `main` branch, path `/root`
3. After 1–2 minutes: `https://<user>.github.io/<repo>/`

**Option 3 — Embed in an existing site**
Use an iframe; styles are fully isolated and won't conflict with your page:

```html
<iframe
  src="https://your-domain.com/tools/"
  style="width:100%;height:520px;border:none;"
  title="Amazon BSR Overtake Calculator">
</iframe>
```

## Directory structure

```text
repo root/
├── index.html          # home navigation (35 tool entries, grouped into 9 categories)
├── assets/
│   ├── tool.css        # shared styles (incl. dark mode)
│   └── tool.js         # shared algorithm library TK (power-law fit, rolling window, rhythm sim, formatting)
├── README.md
└── <tool-name>/index.html   # one folder per tool
```

Most tools make **zero network requests**.

- `snow-radar` calls [Open-Meteo](https://open-meteo.com/)'s public weather API directly from the browser (free, no API key) — only city coordinates are sent, no business data.
- `aba-rank` downloads the DuckDB-WASM engine (~30 MB) from jsDelivr / fastly / unpkg on first analysis (then browser-cached); it only sends word/ASIN data to openrouter.ai if you provide an OpenRouter key — without a key it runs rules-only.
- `desktop-studio` is a Windows local app; its `DesktopStudio-Windows.zip` and docs are published as-is (unencrypted); the app itself is offline and stores config in `%LOCALAPPDATA%\AMZDesktopStudio`.

**No business data ever touches this repo's servers.**

To add a tool: create a folder (e.g. `new-tool/`) with an `index.html` that references `../assets/tool.css` and `../assets/tool.js`, then add a card to the root `index.html` — no duplicated styles or shared algorithms needed.

## Repository note

This repository contains the **deployed build** of the toolbox. The hosted demo is **access-controlled** (password-gated) — contact the author for access. The readable source is maintained privately; this repo is the public, deployable artifact.

## Disclaimer

Tool results are based on **public empirical models** — e.g. the BSR calculator uses the category rank–sales power law `U(r)=K·r^(−α)` to estimate target rank thresholds, layered with a 7-day weighted rolling-window simulation of days-to-target; seasonality uses a centralized moving-average multiplicative decomposition; keywords use a position-share power law for impression allocation. Amazon's actual rank and traffic allocation algorithms are not public, so numeric results are for **direction and decision support only**, not an operational promise or earnings guarantee.

Each tool page states its own calculation basis and applicability — please read the notes at the bottom of the page before use. Real rank and sales are also affected by conversion, reviews, price, ad spend, and competitor dynamics; judge against your own situation.

## License

This project is open source under the **MIT License** — free to use, modify, and commercialize. Stars and derivative works are welcome.
