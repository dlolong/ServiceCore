import assert from "node:assert/strict";import test from "node:test";import{csvCell,reportQuerySchema,resolveReportRange}from"@/lib/reporting";
test("month preset uses branch-local month",()=>assert.deepEqual(resolveReportRange(reportQuerySchema.parse({preset:"month"}),"Asia/Manila",new Date("2026-01-31T16:30:00Z")),{start:"2026-02-01",end:"2026-02-01"}));
test("rolling seven-day range includes today",()=>assert.deepEqual(resolveReportRange(reportQuerySchema.parse({preset:"7d"}),"UTC",new Date("2026-02-10T12:00:00Z")),{start:"2026-02-04",end:"2026-02-10"}));
test("custom range is preserved",()=>assert.deepEqual(resolveReportRange(reportQuerySchema.parse({preset:"custom",start:"2026-01-02",end:"2026-01-09"}),"UTC"),{start:"2026-01-02",end:"2026-01-09"}));
test("CSV cells prevent formula-like content from breaking columns",()=>assert.equal(csvCell('Wash, "premium"'),'"Wash, ""premium"""'));
