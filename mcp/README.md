# murubbi-mcp

The murubbi [Model Context Protocol](https://modelcontextprotocol.io) server. It gives AI agents safe, typed access to murubbi's data.

One server serves several clients: Claude Code while we build, our n8n pipeline, and the murubbi assistant that answers factory owners in Banglish.

## tools

| tool | what it does | access |
|---|---|---|
| `get_factory(os_id)` | a factory's public profile | read |
| `get_trust_score(os_id)` | the score, with plain-language reasons | read |
| `list_exposed_orders(zone)` | open orders exposed to a shock in a zone | read |
| `get_shock_events(zone, since)` | gas, power, flood and unrest events | read |
| `search_news(query, k)` | search Bangladesh supply-chain news | read |
| `triage_news(text, model)` | classify an article for supply risk | read |
| `submit_plan(po, fix, cost, approved_by)` | record a factory's plan | **write**: needs a named human approver |

**Resources:** `murubbi://method/trust-score` · `murubbi://ledger/verify`
**Prompt:** `buyer_update(po)`

## transports

- `stdio` (local)
- Streamable HTTP (demo)

## permissions

- Read-only by default.
- The one write tool needs `approved_by` and appends to a hash-chained ledger that can't be edited.
- Every call is logged.

## run

```bash
pnpm install
pnpm seed     # builds a sample database (all sample data is labelled)
pnpm start    # starts the server on stdio
```

Status: in progress.
