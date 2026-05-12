"use client";

/**
 * Purpose-built React component for the Item 7 "Discovery + Plan" tab.
 *
 * Client-facing, so: real layout + spacing + colored badges, not
 * ASCII art. One card per section. Field model is a card grid. Flow
 * diagram uses real boxes with arrows. Quality tiers are a colored
 * table.
 *
 * When a second Discovery-style item comes along, either duplicate
 * this pattern or generalize via sections-in-JSON. For now, Item 7 is
 * the only one.
 */

import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ArrowDown,
  MapPin,
  Trees,
  FileSearch,
  Layers,
  Package,
  Sparkles,
  Info,
} from "lucide-react";

const stats = [
  { label: "Contracts reviewed", value: "55", sub: "across 11 landowners" },
  { label: "Files inventoried", value: "29", sub: "in the Contracts tree" },
  { label: "Documents read in full", value: "10", sub: "Manulife + Weyerhaeuser + DNR + Hood River" },
  { label: "Landowner formats mapped", value: "4", sub: "3× table, 1× per-unit PDF" },
];

const canonicalGroups = [
  {
    title: "Identity",
    icon: <FileSearch className="h-4 w-4" />,
    accent: "border-primary/40 bg-primary/5",
    titleColor: "text-primary",
    fields: [
      { name: "unit_id", desc: "our internal UUID" },
      { name: "common_name", desc: "landowner's stable unit name" },
      { name: "landowner", desc: "Manulife / Weyerhaeuser / DNR / …" },
      { name: "contract_id", desc: "links to our project record" },
    ],
  },
  {
    title: "Geometry + Location",
    icon: <MapPin className="h-4 w-4" />,
    accent: "border-blue-500/40 bg-blue-500/5",
    titleColor: "text-blue-400",
    fields: [
      { name: "gis_area", desc: "numeric (e.g. 100.49)" },
      { name: "gis_area_unit", desc: "acres / ha" },
      { name: "state", desc: "WA / ID / OR" },
      { name: "county", desc: "for wage-rate lookup" },
      { name: "property", desc: "sub-location label" },
    ],
  },
  {
    title: "Activity",
    icon: <Layers className="h-4 w-4" />,
    accent: "border-yellow-500/40 bg-yellow-500/5",
    titleColor: "text-yellow-400",
    fields: [
      { name: "activity_category", desc: "Planting / Thinning / Spray" },
      { name: "season", desc: "Fall / Spring" },
      { name: "planned_year", desc: "2026" },
      { name: "planned_start", desc: "optional date" },
    ],
  },
  {
    title: "Planting-only",
    icon: <Trees className="h-4 w-4" />,
    accent: "border-green-500/40 bg-green-500/5",
    titleColor: "text-green-400",
    subtitle: "nullable for non-planting",
    fields: [
      { name: "species[]", desc: "Doug-fir / Lodgepole / Redcedar" },
      { name: "target_tpa", desc: "trees per acre (e.g. 300, 360)" },
      { name: "total_trees", desc: "gis_area × target_tpa" },
      { name: "spacing", desc: "optional (e.g. 14×14)" },
      { name: "nursery", desc: "St Maries, etc." },
      { name: "pre_plant_spray", desc: "yes / no" },
      { name: "regeneration", desc: "Plant / Re-Plant" },
    ],
  },
  {
    title: "Silviculture",
    icon: <Sparkles className="h-4 w-4" />,
    accent: "border-cyan-500/40 bg-cyan-500/5",
    titleColor: "text-cyan-400",
    subtitle: "Weyerhaeuser-origin, nullable",
    fields: [
      { name: "stand_key", desc: "landowner unique ID (e.g. 1995281517)" },
      { name: "mu_code", desc: "management unit code" },
      { name: "township_range", desc: "e.g. T07N R02E sec 31" },
      { name: "gps_lat, gps_lon", desc: "decimal coords" },
      { name: "elevation_ft", desc: "numeric" },
      { name: "site_index", desc: "productivity (e.g. 142.0)" },
      { name: "prev_harvest_date", desc: "informs re-plant timing" },
      { name: "best_use", desc: "e.g. Doug Fir Plantation" },
    ],
  },
  {
    title: "Pricing + Payment",
    icon: <Package className="h-4 w-4" />,
    accent: "border-orange-500/40 bg-orange-500/5",
    titleColor: "text-orange-400",
    subtitle: "landowner-shaped",
    fields: [
      { name: "unit_bid_price", desc: "total per unit (or per acre / per 1000 trees)" },
      { name: "unit_total", desc: "total dollars per unit" },
      { name: "chemical_cost_per_acre", desc: "Hood River breakout" },
      { name: "application_cost_per_acre", desc: "Hood River breakout" },
      { name: "prescription_code", desc: "e.g. 'B' — references chemical spec (Hood River)" },
      { name: "payment_model", desc: "quality_tier / application_rate / guarantee_retreat" },
    ],
  },
  {
    title: "Contract + Admin",
    icon: <Package className="h-4 w-4" />,
    accent: "border-purple-500/40 bg-purple-500/5",
    titleColor: "text-purple-400",
    fields: [
      { name: "awarded_contractor", desc: "Ramos / other / multiple" },
      { name: "landowner_office", desc: "Manulife Colville, Hood River Forestry Dept, etc." },
      { name: "source_doc_id", desc: "Drive ID source was read from" },
      { name: "source_format", desc: "e.g. manulife_pct_v2018 (tag)" },
      { name: "imported_at", desc: "when the ingest pulled it" },
    ],
  },
];

const paymentModels = [
  {
    landowner: "Manulife",
    modelKey: "quality_tier",
    accent: "border-green-500/40 bg-green-500/5",
    titleColor: "text-green-400",
    description: "Quality-tier multiplier from Exhibit B audit result",
    tiers: [
      { label: "90%+", outcome: "10% bonus", tone: "text-green-400 bg-green-500/15" },
      { label: "80–89.9%", outcome: "Full payment", tone: "text-green-400 bg-green-500/10" },
      { label: "70–79.9%", outcome: "Prorated / re-plant", tone: "text-yellow-400 bg-yellow-500/10" },
      { label: "<70%", outcome: "No payment / re-plant", tone: "text-red-400 bg-red-500/10" },
    ],
    source: "Manulife Exhibit B Seedling Handling and Planting Specifications, rev. 1/1/2018, p.6",
  },
  {
    landowner: "DNR",
    modelKey: "application_rate",
    accent: "border-yellow-500/40 bg-yellow-500/5",
    titleColor: "text-yellow-400",
    description: "Proportional reduction when actual application falls below specified",
    formula: "(gallons applied ÷ gallons specified) × unit bid price = unit payment",
    note: "Example from contract: 50 acres × 10 gal/acre = 500 gal specified. 420 gal applied = 84% = $3,150 instead of $3,750 bid.",
    source: "DNR Contract #3297, Section I-C-03-E-06",
  },
  {
    landowner: "Hood River County",
    modelKey: "guarantee_retreat",
    accent: "border-orange-500/40 bg-orange-500/5",
    titleColor: "text-orange-400",
    description: "Binary pass-or-retreat — no tier math",
    note: "Contractor guarantees the work. Failed tracts get retreated. County pays the application fee on retreat; contractor eats chemical + admin cost.",
    source: "Hood River 2026 Spring Ground Vegetation Control Services Agreement, Scope of Request §12",
  },
  {
    landowner: "Weyerhaeuser",
    modelKey: "unknown",
    accent: "border-muted bg-muted/10",
    titleColor: "text-muted-foreground",
    description: "Payment terms not yet reviewed",
    note: "PlantationExam PDFs are unit descriptions, not contract terms. Need the Weyerhaeuser services agreement to determine payment model.",
    source: "blocked on Jaime sample",
  },
];

const stillNeeded = {
  high: [
    { title: "DNR Exhibit 2-H / Section II", note: "The #3297 contract PDF is only the legal body — unit descriptions + bid form live in a separate Section II doc not yet sent" },
    { title: "Payroll dump (messy OK)", note: "Blocks Item 9 invoicing design + Item 7 completion" },
    { title: "Second Weyerhaeuser contract sample", note: "Have 2 per-unit map PDFs from one contract — need one more to verify format consistency across projects" },
  ],
  medium: [
    { title: "Private landowner samples (1-2)", note: "11 private contracts, 0 files — at least one shape needed to design flex" },
    { title: "Contacts list — any form", note: "Whatever lives today: spreadsheet / email / phone export" },
    { title: "Sample invoice + Jose's scribbles", note: "Current workflow artifact + how it gets transcribed" },
  ],
  low: [
    { title: "Vaagen / Chilton / Chelan / USACE samples", note: "Future-proofing the column-map layer — not blocking Item 7" },
  ],
};

const nextUp = [
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Canonical field model drafted from real data (7 groups, 4 landowner formats)" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Manulife formats read + mapped (PCT + Planting)" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Weyerhaeuser PlantationExam format read + mapped" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "DNR contract body read — Exhibit 2-H bid form still needed" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Hood River Services Agreement + bid form read — new 4th landowner captured" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Intake architecture decided — drop files in Unit Ingest/{Landowner}/, archive-after-ingest" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "AI-assisted column mapping approved for scope (fallback for onboarding new formats)" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Payment math mapped per landowner (quality_tier / application_rate / guarantee_retreat)" },
  { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, text: "Items 8, 9, 10 scope refined based on findings" },
  { icon: <Circle className="h-4 w-4 text-muted-foreground" />, text: "Easy-vs-fuller Item 8 estimate — drafts after remaining samples arrive" },
  { icon: <Info className="h-4 w-4 text-blue-400" />, text: "Running hour log lands in the Monday email" },
];

export function Item7DiscoveryPlan() {
  return (
    <div className="px-4 py-4 space-y-6">
      {/* Intro */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Discovery + Plan</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Item 7 progress report. What the review covered, the pattern that emerged, and how Items 8–10 flow from it.
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 italic">Updated 2026-04-19</p>
      </div>

      {/* Section 1 — Review stats */}
      <Section title="1. What was reviewed" icon={<FileSearch className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card/40 px-3 py-2">
              <div className="text-lg font-bold font-mono text-primary">{s.value}</div>
              <div className="text-[11px] font-medium text-foreground">{s.label}</div>
              <div className="text-[10px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-lg border border-border bg-card/30 p-3">
            <div className="font-medium text-foreground mb-1">Review coverage</div>
            <ul className="space-y-1 text-muted-foreground">
              <li>• DATA DUMP folder — 8 category buckets, Projects current folder with 6 docs + Hood River subfolder</li>
              <li>• Everyone / Contracts tree — 55 contracts, 29 files, 10 contracts with any content</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card/30 p-3">
            <div className="font-medium text-foreground mb-1">Read in full</div>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Ramos Awarded Units.xlsx <span className="text-foreground">(24 units, 15 cols)</span></li>
              <li>• Manulife PCT Office Data Sheet <span className="text-foreground">(23 units / 1459.6 acres)</span></li>
              <li>• Ramos Planting Units sp26 <span className="text-foreground">(12 units / 695.95 acres / 222k trees)</span></li>
              <li>• Manulife Exhibit B <span className="text-foreground">(legal + quality tiers)</span></li>
              <li>• Weyerhaeuser PlantationExam × 2 <span className="text-foreground">(per-unit map PDFs)</span></li>
              <li>• DNR Contract #3297 <span className="text-foreground">(contract body, 18 pages)</span></li>
              <li>• Hood River bid acceptance + services agreement <span className="text-foreground">(13 tracts, $21,732.47)</span></li>
              <li>• Hood River bid form <span className="text-foreground">(149.2 acres, Peach / Quokka / Quinoa sales)</span></li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Section 2 — Pattern */}
      <Section title="2. The pattern" icon={<Sparkles className="h-4 w-4" />}>
        <div className="text-[11px] text-foreground leading-relaxed">
          Four landowner formats reviewed. Each has different column names and physical layout, but the same underlying data. Key insight: <span className="text-foreground font-medium">data points are stable, packaging varies</span>.
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <LandownerFormatCard
            landowner="Manulife"
            format="Table with rows"
            accent="border-green-500/40 bg-green-500/5"
            titleColor="text-green-400"
            example="CommonName, GIS Area, County, Property, Activity Category, Season, …"
            note="Many units per sheet. Clean ingest — loop rows, apply column-map."
          />
          <LandownerFormatCard
            landowner="Weyerhaeuser"
            format="One unit per PDF"
            accent="border-blue-500/40 bg-blue-500/5"
            titleColor="text-blue-400"
            example="StandKey, MU Code, Forestable Acres, Site Index, Best Use, …"
            note="Corner-metadata per map PDF. Needs per-PDF extraction, not row-by-row."
          />
          <LandownerFormatCard
            landowner="DNR"
            format="Embedded in contract"
            accent="border-yellow-500/40 bg-yellow-500/5"
            titleColor="text-yellow-400"
            example="Unit Bid Price, Unit Total, Unit Description, Exhibit 2-H Bid Form …"
            note="Unit table + maps live in a separate Section II document (not yet received)."
          />
          <LandownerFormatCard
            landowner="Hood River County"
            format="Table with rows"
            accent="border-orange-500/40 bg-orange-500/5"
            titleColor="text-orange-400"
            example="Sale Name-Unit, Acres, Prescription, Chemical Cost/Acre, Application Cost/Acre, Bid Price/Unit"
            note="Ramos just won a $21,732.47 spring contract. 13 tracts / 149.2 acres. Pricing broken out into chemical + application — more granular than Manulife."
          />
        </div>

        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">Stable identifiers across all four</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <KV k="unit name" v="Manulife CommonName / Weyer StandKey+MU / DNR Unit Number / Hood River Sale-Unit" />
            <KV k="area" v="acres everywhere (Manulife GIS Area / Weyer Forestable Acres / DNR Unit acreage / Hood River Acres)" />
            <KV k="geography" v="county + state in all four (township/range + GPS on Weyer)" />
            <KV k="activity" v="work type (Planting / PCT / Herbicide / Ground Vegetation Control)" />
            <KV k="season / timing" v="Fall/Spring season, planned start date, or prior harvest date" />
          </div>
          <div className="mt-3 border-t border-primary/20 pt-2 space-y-1 text-[10px] text-muted-foreground">
            <div>Weyerhaeuser adds: <span className="text-foreground">StandKey, MU Code, Township/Range, GPS, Elevation, Site Index, Harvest Date, Best Use</span></div>
            <div>DNR adds: <span className="text-foreground">Unit Bid Price (per-acre or per-1000-trees), Unit Total, Application-rate compliance math</span></div>
            <div>Hood River adds: <span className="text-foreground">Prescription code, Chemical Cost/Acre + Application Cost/Acre breakout</span></div>
          </div>
        </div>

      </Section>

      {/* Section 3 — Canonical Field Model */}
      <Section title="3. Canonical field model" icon={<Layers className="h-4 w-4" />} subtitle="draft — grouped into 5 logical blocks">
        <p className="text-[11px] text-muted-foreground mb-3">
          The list of fields the platform stores for every unit, regardless of which landowner's sheet it came from. The per-landowner column-map (next section) translates the source columns into these canonical fields.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {canonicalGroups.map((g) => (
            <div key={g.title} className={`rounded-lg border p-3 ${g.accent}`}>
              <div className={`flex items-center gap-2 mb-2 text-xs font-semibold ${g.titleColor}`}>
                {g.icon}
                <span>{g.title}</span>
                {g.subtitle && <span className="text-[10px] font-normal text-muted-foreground italic ml-auto">{g.subtitle}</span>}
              </div>
              <ul className="space-y-1 text-[11px]">
                {g.fields.map((f) => (
                  <li key={f.name} className="flex gap-2">
                    <code className="font-mono text-[10px] shrink-0 text-foreground">{f.name}</code>
                    <span className="text-muted-foreground">{f.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 4 — Column-map pattern */}
      <Section title="4. Column-map pattern" icon={<Package className="h-4 w-4" />}>
        <p className="text-[11px] text-muted-foreground mb-3">
          A small config lives per landowner + format combo. When a new file lands, the ingest applies the matching map to translate that landowner's columns into the canonical fields.
        </p>
        <pre className="rounded-lg border border-border bg-muted/30 p-3 text-[10px] font-mono overflow-x-auto leading-relaxed">{`{
  landowner: "Manulife",
  format:    "PCT office v2018",
  columns: {
    "CommonName":              "common_name",
    "GIS Area":                "gis_area",
    "GIS Area Unit Type":      "gis_area_unit",
    "Primary County":          "county",
    "Primary State or Province": "state",
    "Property":                "property",
    "Activity Category2":      "activity_category",
    "Season":                  "season",
    "PlannedYear":             "planned_year"
  }
}`}</pre>
        <ol className="mt-3 space-y-1.5 text-[11px] text-foreground list-decimal list-inside">
          <li className="text-muted-foreground"><span className="text-foreground">Detect the format</span> — landowner + column-header fingerprint → picks the right map.</li>
          <li className="text-muted-foreground"><span className="text-foreground">Apply the map</span> — source columns become canonical fields.</li>
          <li className="text-muted-foreground"><span className="text-foreground">Flag anything unmapped</span> → pending queue for office review. Same pattern as the Expenses pipeline.</li>
        </ol>
        <p className="mt-3 text-[11px] text-muted-foreground">
          New landowner formats are onboarded by adding one new column-map entry — <span className="text-foreground">no code change per landowner</span>.
        </p>

        <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-yellow-400 mb-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Two ingest modes needed</span>
          </div>
          <div className="text-[11px] text-foreground leading-relaxed">
            The formats split cleanly into two shapes that need different parsers:
          </div>
          <ul className="mt-2 space-y-1.5 text-[11px]">
            <li className="flex gap-2">
              <span className="font-mono text-[10px] text-foreground mt-0.5 shrink-0 bg-muted px-1.5 rounded">Mode A</span>
              <span className="text-muted-foreground"><span className="text-foreground">Table with rows</span> — Manulife-style. Loop rows, apply column-map per row. (Also how the Expenses pipeline works.)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-[10px] text-foreground mt-0.5 shrink-0 bg-muted px-1.5 rounded">Mode B</span>
              <span className="text-muted-foreground"><span className="text-foreground">One unit per document</span> — Weyerhaeuser-style. Extract per-PDF metadata, one row per file.</span>
            </li>
          </ul>
          <div className="mt-2 text-[10px] text-muted-foreground">
            DNR is Mode A once the Exhibit 2-H bid form arrives — it's a table, just currently in a separate doc.
          </div>
        </div>
      </Section>

      {/* Section 5 — Flow */}
      <Section title="5. How Items 8–10 flow from this">
        <div className="space-y-3">
          <FlowBox
            accent="border-primary bg-primary/10"
            title="Item 7 — you're here"
            body="Discovery + canonical field model"
          />
          <FlowArrow />
          <FlowBox
            accent="border-yellow-500/40 bg-yellow-500/5"
            title="Item 8 — Unit Data Ingest"
            body="Per-landowner column-maps, pending queue, audit trail. Every unit sheet from any landowner becomes a row in canonical schema."
          />
          <FlowArrow />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FlowBox
              accent="border-blue-500/40 bg-blue-500/5"
              title="Item 9 — Invoicing"
              body="Completed units × contract rate × Exhibit B quality tier → invoice."
            />
            <FlowBox
              accent="border-purple-500/40 bg-purple-500/5"
              title="Item 10 — Other Data Ingest"
              body="Same ingest pattern applied to contacts, bids, equipment, compliance docs."
            />
          </div>
        </div>
      </Section>

      {/* Section 6 — Payment models (was Quality Tiers) */}
      <Section title="6. Payment math varies by landowner" subtitle="Item 9 invoicing needs a per-landowner payment model, not a single formula">
        <p className="text-[11px] text-muted-foreground mb-3">
          Every landowner reviewed uses a different payment model. Item 9 stores a <code className="font-mono text-[10px] bg-muted px-1 rounded">payment_model</code> per contract and applies the right math at invoice time.
        </p>
        <div className="space-y-3">
          {paymentModels.map((m) => (
            <div key={m.landowner} className={`rounded-lg border p-3 ${m.accent}`}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`text-xs font-semibold ${m.titleColor}`}>{m.landowner}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{m.modelKey}</span>
              </div>
              <p className="mt-1 text-[11px] text-foreground leading-relaxed">{m.description}</p>
              {m.formula && (
                <div className="mt-2 rounded bg-muted/30 px-2 py-1 text-[10px] font-mono text-foreground">{m.formula}</div>
              )}
              {m.tiers && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {m.tiers.map((t) => (
                    <div key={t.label} className={`rounded px-2 py-1 text-[10px] flex items-center gap-2 ${t.tone}`}>
                      <span className="font-mono font-semibold">{t.label}</span>
                      <span>{t.outcome}</span>
                    </div>
                  ))}
                </div>
              )}
              {m.note && <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed italic">{m.note}</p>}
              <p className="mt-2 text-[10px] text-muted-foreground">Source: {m.source}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Section 7 — What's still needed */}
      <Section title="7. What's still needed" icon={<AlertTriangle className="h-4 w-4" />} subtitle="live on the Kanban board as blocked cards assigned to Jaime">
        <div className="space-y-3">
          <BlockedGroup label="High priority — blocks Item 8 design" tone="orange" items={stillNeeded.high} />
          <BlockedGroup label="Medium priority — blocks Items 9–10" tone="yellow" items={stillNeeded.medium} />
          <BlockedGroup label="Low priority — future-proofing" tone="muted" items={stillNeeded.low} />
        </div>
      </Section>

      {/* Section 8 — Status + next */}
      <Section title="8. Status + next up">
        <ul className="space-y-2">
          {nextUp.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px]">
              <span className="mt-0.5 shrink-0">{n.icon}</span>
              <span className="text-foreground">{n.text}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Helpers                                                         */
/* ─────────────────────────────────────────────────────────────── */

function Section({ title, icon, subtitle, children }: { title: string; icon?: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
        {subtitle && <span className="text-[10px] text-muted-foreground italic">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="leading-snug">
      <span className="font-mono text-[10px] text-foreground">{k}</span>
      <div className="text-[10px] text-muted-foreground">{v}</div>
    </div>
  );
}

function FlowBox({ accent, title, body }: { accent: string; title: string; body: string }) {
  return (
    <div className={`rounded-lg border-2 p-3 ${accent}`}>
      <div className="text-xs font-semibold text-foreground">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{body}</div>
    </div>
  );
}

function LandownerFormatCard({ landowner, format, accent, titleColor, example, note }: {
  landowner: string;
  format: string;
  accent: string;
  titleColor: string;
  example: string;
  note: string;
}) {
  return (
    <div className={`rounded-lg border p-3 ${accent}`}>
      <div className={`text-xs font-semibold ${titleColor}`}>{landowner}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{format}</div>
      <div className="text-[10px] text-foreground/80 mt-2 font-mono leading-snug">{example}</div>
      <div className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{note}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center">
      <ArrowDown className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

function BlockedGroup({ label, tone, items }: {
  label: string;
  tone: "orange" | "yellow" | "muted";
  items: { title: string; note: string }[];
}) {
  const colorCls = {
    orange: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    muted: "text-muted-foreground bg-muted/30 border-border",
  }[tone];
  return (
    <div>
      <div className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium mb-2 ${colorCls}`}>
        {label}
      </div>
      <ul className="space-y-1.5 ml-1">
        {items.map((it) => (
          <li key={it.title} className="flex items-start gap-2 text-[11px]">
            <Circle className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <span className="font-medium text-foreground">{it.title}</span>
              <span className="text-muted-foreground"> — {it.note}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
