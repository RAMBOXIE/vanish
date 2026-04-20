# SCAN_WELCOME

State: **SCAN_WELCOME**

Vanish can scan 210 data brokers to discover where your personal information is exposed, before deciding what to remove.

Prompt template:
- Explain: "I'll scan ~200 data sources and show you where your data is likely exposed. No external API calls — uses heuristic matching based on broker catalog."
- Tell user: Reply with anything to proceed to SCAN_INPUT.
- Allow commands: `status` / `back` / `pause` / `resume`.
- Skip hint: To skip scan and go straight to cleanup, restart with `{ skipScan: true }`.
