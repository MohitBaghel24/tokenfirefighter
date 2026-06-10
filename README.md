# TokenFirefighter 🧯

![npm version](https://img.shields.io/npm/v/tokenfirefighter)
![license](https://img.shields.io/npm/l/tokenfirefighter)
![build status](https://img.shields.io/github/actions/workflow/status/YOURNAME/tokenfirefighter/ci.yml)

Free local proxy that prevents AI API cost runaway loops.

## Why

*The $23K story:* AI agents and autonomous scripts can easily enter infinite loops. A bug in a recursive function or a model hallucination can result in thousands of API calls within minutes, burning through thousands of dollars before you can hit stop. **TokenFirefighter** sits locally between your code and the providers (OpenAI, Anthropic) to actively monitor, budget, and block runaway loops.

## Quick Start

```bash
npm install -g tokenfirefighter
tokenfirefighter init
export OPENAI_BASE_URL=http://localhost:7272/v1
export OPENAI_API_KEY=your-key-here
tokenfirefighter start
```

## How it works

TokenFirefighter runs locally as a proxy server and renders a live interactive terminal dashboard. The dashboard tracks your daily and session spending, monitors active API calls, and flashes a bright red alert if a loop or budget limit is triggered.

## Loop Detection

TokenFirefighter utilizes 4 layers of loop detection:
1. **Layer 1: Exact Hash Match** - Blocks identical request bodies repeating unnaturally fast.
2. **Layer 2: Token Trajectory** - Detects unchecked inflation where prompts grow exponentially due to recursive appending.
3. **Layer 3: Content Similarity** - Uses Jaccard similarity to spot agents slightly modifying text in infinite retry loops.
4. **Layer 4: Error Retry Storms** - Catches tools or scripts stuck in rapid retry loops against provider error codes (like 400s or 500s).

## Configuration

When you run `tokenfirefighter init`, a `config.yaml` is generated at `~/.tokenfirefighter/config.yaml`:

```yaml
server:
  port: 7272
  host: "127.0.0.1"
budget:
  daily_max_usd: 50.0
  session_max_usd: 10.0
providers:
  openai:
    api_key: "${OPENAI_API_KEY}"
    base_url: "https://api.openai.com/v1"
```

## Contributing

Found a bug or want to suggest an improvement? Please visit our [Issues page](https://github.com/YOURNAME/tokenfirefighter/issues).

---
Made with 🔥 by TokenFirefighter Contributors
