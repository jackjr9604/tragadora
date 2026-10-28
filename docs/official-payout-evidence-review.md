# Offline review of proposed official payout sources

This workflow prepares evidence for human review. It performs no network requests, loads no environment credentials and has no database client. It never authorizes an import or produces an insert payload. Do not commit private input/output reports.

```text
npx tsx scripts/review-official-payout-evidence.ts <private-input.json> <new-private-output.json>
npx tsx --test scripts/official-payout-evidence.test.ts
```

Input is an array of `OfficialPayoutEvidence` objects (see the exported type in `scripts/official-payout-evidence.ts`). Output must be a new file and cannot overwrite input evidence. Console output contains aggregate review counts only.

Preserve the original statement, decimal value as a string, currency, precision and comparison operator. A statement with `+` remains an unqualified lower bound unless the source explicitly states its operator. It cannot become an exact figure. Missing currency or a missing data cutoff blocks a candidate; the time a page was successfully accessed is not its data cutoff.

Firm totals, individual payments, a participant's cumulative rewards, allocation/funding and commercial conditions are different scopes. Only a declared exact firm total with a confirmed period can become an exact candidate for human review. Approximate figures and bounds remain references even with otherwise complete evidence. No result is permission to load data.

Calendar periods and rolling periods require explicit boundaries. A monthly claim without an identified month is not rolling 30d. Lifetime figures cannot be mixed with a rolling window. Do not derive short-period values by subtracting rounded figures, bounds or amounts with unknown cutoffs.

The reviewer checks declared metadata and obvious contradictions in the statement. It does not prove source ownership, wallet attribution, completeness, numeric transcription, currency, or payment authenticity. Confirm these from official evidence before proposing a collector. A source that blocks browser access remains blocked; do not bypass its controls. Third-party partial blockchain trackers require their own coverage review and must not be submitted as official full-firm totals.

Keep prices, discounts, challenge rules, payout eligibility and jurisdiction restrictions in a separate field-level evidence review. They are not evidence of completed payouts. This workflow adds no public UI.
