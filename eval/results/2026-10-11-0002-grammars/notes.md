This run measures one change, in tool mode only, against run `2026-10-11-0002-descriptions`. Each grammar anchored at both ends (`^…$`) now has its regular expression in its description, beside its words. Text's `\S` stays in words only. The change also reaches the prompt and `json_schema` schemas, which this run did not measure.

Cells are small: 54 per model, 45 per kind.

### F1. The regular expression halves grammar failures, and moves the valid rate a little

- Tool mode went from 110/270 valid to 115/270.
- Schema failures that name a grammar went from 23 to 12. Across the runs so far:
  - 28 with patterns (`2026-10-11`);
  - 39 without them and with descriptions lost (`2026-10-11-0002`);
  - 23 with descriptions in words only (`2026-10-11-0002-descriptions`);
  - 12 with the regular expressions (this run).
- Most were a premise's subject outside the key grammar: 11 before, 5 now (`/premises/*/subject`).
- Premise went from 16/45 to 20/45, and `qwen3-30b` from 31/54 to 35/54. Every other model moved by at most one.
- The valid rate moves less than grammar failures do because the failures that remain in tool mode are not about grammar. `gpt-oss-120b` writes nested objects as prose (7/54). `granite-4.0-h-micro` double-encodes its arguments (0/54).

### Calls

270 inference calls, none retried and none lost. The local Worker did not reload during the run.
