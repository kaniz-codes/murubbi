# murubbi-signals-mcp

Bangladesh's public shock feeds as [Model Context Protocol](https://modelcontextprotocol.io) tools. Agents get clean, cached signals, so nobody scrapes a site directly.

## tools

| tool | what it does |
|---|---|
| `get_gas_report(date)` | daily gas supply by sector and distributor |
| `get_power_status(hours)` | recent national power generation |
| `fetch_news(since)` | new supply-chain news, deduplicated |
| `detect_anomaly(series)` | flags a real drop vs normal supply |

## transport

- `stdio`

## used by

- murubbi-mcp
- our n8n pipeline
- Claude Code

Status: in progress.
