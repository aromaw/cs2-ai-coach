# Implementation Notes

## Current MVP

The repository now contains a runnable local MVP for the first PRD loop:

```text
Upload a supported CS2 .dem
-> parse into structured match data
-> select the user's five-player team
-> choose a focus player
-> generate personal habits, team issues, key rounds, tactics, and training plan
-> export Markdown report
```

The app intentionally uses a small dependency-free Node.js server so it can run in restricted local environments without installing packages.

## Important Parser Boundary

`src/parserRunner.js` is the parser integration boundary. Uploads are saved first, then the app calls a configured external parser. By default it looks for `bin/cs2-demoparser`, which is built from `cmd/demoparser` with `demoinfocs-golang`.

Normal uploads are strict: if the real parser is missing, fails, or emits an inconsistent contract, the request fails instead of silently inventing match data. The product sample uses the separate `POST /api/sample` endpoint and is explicitly marked `synthetic-sample`; it never shares the real upload path. `CS2_DEMO_PARSER_ALLOW_FALLBACK=true` remains an opt-in development escape hatch and must not be enabled in production.

The current Go parser decodes:

- final Source 2 header/server-info map name
- players and stable team ids across halftime side swaps
- completed regulation/overtime rounds while excluding warmup and rolling back restarted/incomplete rounds
- score derived from completed round winners, plus side win rates
- enemy kills, deaths, assists, scoreboard damage/utility damage, C4 events, flash results, and real round-relative timestamps
- KAST, opening duels, trades, traded deaths, average trade time, and utility-impact rounds
- evidence with explicit thresholds for far untraded deaths, team flashes, repeated named death areas, economy mismatches, and early post-plant deaths
- sampled place-name path summaries instead of raw coordinate strings
- per-team round-start equipment snapshots and buy classification

Map-specific tactics remain Mirage-only. Other recognized maps receive generic evidence-driven tactics and never inherit Mirage locations.

Platform demos (Perfect World/完美平台, 5E) share the same `PBDEMS2` wire format as Valve demos, so the data layer parses them identically; upload the downloaded `.zip` directly.

The production parser should continue expanding this output while preserving the current shape:

- decode map, teams, players, sides, score, and round boundaries
- extract kills, deaths, damage, utility, economy, C4, and position events
- aggregate path/location summaries instead of sending raw tick data to the AI layer
- pass the same `match.players`, `match.rounds`, `match.evidence`, and player stat fields to `src/analyzer.js`

The current API and UI do not need to change when the parser is swapped as long as that contract is preserved.

### Real Parser CLI Contract

Build the included real parser with:

```sh
npm run build:parser
```

The server auto-detects `bin/cs2-demoparser`. To configure a different parser:

```sh
CS2_DEMO_PARSER_BIN=/absolute/path/to/parser npm start
```

The app calls the parser as:

```sh
$CS2_DEMO_PARSER_BIN /path/to/upload.dem
```

The parser must write one JSON document to stdout. The document must include:

- `parser.name`
- `match.id`
- `match.map`
- `match.score.team_a`
- `match.score.team_b`
- `match.players[]` with `id`, `name`, `teamId`, and `stats`
- `match.rounds[]` with `number`, `winnerTeamId`, `sideByTeam`, and `events`
- `match.evidence[]` with `id`, `playerId`, `round`, `time`, `location`, and `description`

Parser output validation rejects duplicate players/rounds/evidence, incomplete teams, invalid team/side mappings, score-round mismatches, bad evidence references, and non-`m:ss` evidence timestamps. Normal uploads fail hard by default.

`tools/mock-real-parser.sh` is a fixture parser used by tests to prove the external parser path.

### demoinfocs Status

`demoinfocs-golang/v4.5.1` is now wired into `cmd/demoparser`. `goproxy.cn` was required in this environment because the default Go proxy timed out.

## API

- `POST /api/uploads?filename=<name.dem|name.zip>`
  - body: raw `.dem` bytes, or a platform archive (Perfect World 完美平台 downloads are standard zips containing a `.dem`)
  - zip handling: zero-dependency extraction (`src/zipDem.js`), prefers the `.dem` entry, verifies the `PBDEMS2` magic, and rejects archives whose extracted demo would exceed 1 GB (zip-bomb guard)
  - response: upload metadata (inner dem name plus original archive name), parser metadata, structured match data
- `POST /api/sample`
  - creates an explicitly synthetic Mirage product sample; it is isolated from real uploads
- `POST /api/reports`
  - body: `{ "uploadId": "...", "teamPlayerIds": ["p1", "..."], "focusPlayerId": "p1", "targetRole": "Support" }`
  - response: full evidence-driven report
- `GET /api/reports`
  - response: report history summaries
- `GET /api/reports/:id`
  - response: full report JSON
- `GET /api/reports/:id/export`
  - response: Markdown export
- `POST /api/feedback`
  - body: `{ "reportId": "...", "targetType": "habit", "targetId": "...", "rating": "useful" }`
  - response: saved local feedback entry

## Optional AI Layer

The report is rules-first. `src/aiRunner.js` builds a compressed evidence packet after the rule engine has produced structured findings. By default reports include `aiCoach.mode = "rules-only"`.

To attach an external AI explainer:

```sh
CS2_COACH_AI_BIN=/absolute/path/to/ai-command npm start
```

The AI command receives one JSON packet on stdin and must write one JSON object to stdout:

```json
{
  "provider": "my-ai",
  "summary": "Evidence-grounded coaching summary",
  "priorities": ["..."],
  "caveats": ["..."]
}
```

The AI output is displayed as an additive explanation layer. It does not replace the structured evidence, key rounds, tactics, or training plan generated by the rule engine. `tools/mock-ai-coach.sh` is used by tests to verify this contract.

## Evidence Rules Implemented

- every negative personal habit includes round, time, location, event, fix, and training
- every tactic includes map, side, economy, objective, five-player assignments, opening setup, utility, timing, contingency, fit reason, and evidence
- report creation rejects selections that are not exactly five players from the same team
- key rounds include result, timeline, main mistake, better play, tags, and related player ids
- report generation accepts a target role preference and explains whether the evidence supports it
- local useful/inaccurate feedback is stored for suggestions and tactics

## Verification

Run:

```sh
npm run build:parser
npm test
GOCACHE=$(pwd)/.cache/go-build go test ./...
npm start
```

The app runs at `http://localhost:4173` by default. Set `PORT=xxxx` before starting `node src/server.js` to use another port.

Accuracy changes were end-to-end checked against official demoinfocs Source 2 fixtures for Ancient (21 rounds), Anubis (14 rounds), and Inferno (17 rounds), including map detection, halftime team identity, completed-round score consistency, player count, non-zero ADR, and parser contract validation.
