# TokenFirefighter Tool Compatibility Registry

This document lists the compatibility and support levels for popular developer environments and AI coding assistants when integrating with TokenFirefighter.

## Support Levels

- **Full (✅)**: Auto-configured by running `tokenfirefighter setup`. Ready to run with zero manual configuration.
- **Partial (⚠️)**: Supported, but requires manual configuration of the base URL or environment variables within the tool.
- **None (❌)**: Not supported or incompatible due to proprietary protocols, hardcoded endpoints, or security restrictions.

---

## Compatibility Table

| Tool | Support Level | Notes |
| :--- | :--- | :--- |
| **Kimchi** | ✅ Full | Auto-configured |
| **Claude Code** | ✅ Full | Auto-configured |
| **OpenCode** | ✅ Full | Auto-configured |
| **OpenAI SDK** | ✅ Full | Auto-configured via `.env` |
| **Ollama** | ✅ Full | Auto-configured |
| **Continue.dev** | ✅ Full | Auto-configured |
| **Aider** | ✅ Full | Auto-configured |
| **LiteLLM** | ✅ Full | Auto-configured |
| **Jupyter AI** | ⚠️ Partial | Requires manual `OPENAI_API_BASE` env var |
| **Continue.dev (self-host)** | ⚠️ Partial | Requires manual configuration (see docs) |
| **LocalAI** | ⚠️ Partial | Requires manual base URL change |
| **Cursor** | ⚠️ Partial | Settings → OpenAI API base URL (no CLI yet) |
| **Cody (Sourcegraph)** | ❌ None | Uses proprietary API, cannot proxy |
| **AWS CodeWhisperer** | ❌ None | IAM-based auth, cannot intercept |
| **Tabnine** | ❌ None | Proprietary endpoint, cannot proxy |
| **Copilot** | ❌ None | GitHub-managed endpoints, not interceptable |

---

Run `tokenfirefighter setup` to configure any supported tool automatically.
