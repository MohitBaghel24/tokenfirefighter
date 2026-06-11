![npm version](https://img.shields.io/npm/v/tokenfirefighter)
![license](https://img.shields.io/badge/license-MIT-blue)
![node](https://img.shields.io/badge/node-%3E%3D18-green)

# TokenFirefighter 🔥🚫

> Stop AI API cost runaway before it burns your wallet.

One-command setup. Zero config files to edit. Works with Kimchi, Claude Code, OpenCode, and more.

```text
┌────────────────────────────────────────────────────────────────────────┐
│  TERMINAL                                                              │
│                                                                        │
│  $ tokenfirefighter start                                              │
│  🧯 TokenFirefighter starting on localhost:7272                        │
│  TokenFirefighter proxy listening on 127.0.0.1:7272                    │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │  TokenFirefighter v1.0.0             [ STATUS: PROTECTED ]  │          │
│  ├──────────────────────────────────────────────────────────┤          │
│  │  Daily Limit:   $0.89 / $5.00   [██░░░░░░░░░░░░░░░░░] 17.8% │          │
│  │  Session Limit: $0.12 / $1.00   [████░░░░░░░░░░░░░░░] 12.0% │          │
│  │                                                          │          │
│  │  LOGS:                                                   │          │
│  │  [12:34:01 PM] [PROXY] Kimchi ──► OpenAI gpt-4o | $0.002 │          │
│  │  [12:35:12 PM] [PROXY] Kimchi ──► OpenAI gpt-4o | $0.001 │          │
│  └──────────────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

- [What is TokenFirefighter?](#what-is-tokenfirefighter)
- [Quick Start](#quick-start)
- [Supported Tools](#supported-tools)
- [Step-by-Step Setup](#step-by-step-setup)
- [Verify It's Working](#verify-its-working)
- [Common Problems & Fixes](#common-problems--fixes)
- [Uninstall](#uninstall)

---

## What is TokenFirefighter?

**TokenFirefighter** is a friendly, local proxy server that runs on your machine. It sits between your AI assistants (such as Kimchi, Claude Code, Aider, or Cursor) and your AI service providers (such as OpenAI, Anthropic, or Gemini). 

**Why do you need it?** 
Autonomous AI agents can sometimes enter infinite "runaway loops" due to code bugs, API error storms, or model hallucinations. In just a few minutes, a looping agent can make thousands of requests, draining your budget and leaving you with a massive bill. 

TokenFirefighter acts like a smart fuse box:
1. **Zero-Config Setup**: Automatically routes your AI tools through a local server.
2. **Real-Time Cost Tracking**: Automatically calculates token counts and dollar amounts for every single request.
3. **Runaway Loop Guard**: Intercepts and blocks repeating requests, exponential token growth, and error storms before they reach the provider.
4. **Hard Spending Limits**: Instantly cuts off access once your daily or session dollar budget is reached.

---

## Quick Start

Secure your wallet in under 5 minutes with just three simple commands:

```bash
npm install -g tokenfirefighter
tokenfirefighter setup
tokenfirefighter doctor
```

That's it. Your AI tool is now protected.

```text
┌────────────────────────────────────────────────────────────────────────┐
│  $ npm install -g tokenfirefighter                                     │
│  + tokenfirefighter@1.0.0                                              │
│  added 1 package in 1.48s                                              │
│                                                                        │
│  $ tokenfirefighter setup                                              │
│                                                                        │
│    TokenFirefighter Setup                                              │
│    ──────────────────────                                              │
│    Which AI tool are you using?                                        │
│    > Kimchi                                                            │
│                                                                        │
│    Configuring Kimchi... ✓                                             │
│    Enter your OpenAI API key: •••••••••••••••••••••••••                │
│    Enter your Anthropic API key: •••••••••••••••••••••••••             │
│                                                                        │
│    ✅ Done. Kimchi is protected.                                       │
│                                                                        │
│  $ tokenfirefighter doctor                                             │
│                                                                        │
│    TokenFirefighter Doctor                                             │
│    ───────────────────────                                             │
│    Proxy running     ✓ (localhost:7272)                                │
│    Kimchi setup      ✓ (Configured to use proxy)                       │
│                                                                        │
│    🎉 Everything is configured correctly! You are ready to go.          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Supported Tools

TokenFirefighter supports a wide range of developer environments and AI coding assistants. The compatibility table below outlines what level of setup is supported:

- **Full (✅)**: Configured automatically in seconds using the setup wizard.
- **Partial (⚠️)**: Supported, but requires manual configuration of base URLs or environment variables.
- **None (❌)**: Not compatible due to closed APIs, hardcoded endpoints, or security protocols.

| Tool | Status | Auto-Setup / Manual Configuration |
| :--- | :--- | :--- |
| **Kimchi** | ✅ Full | `tokenfirefighter setup` (Select **Kimchi**) |
| **Claude Code** | ✅ Full | `tokenfirefighter setup` (Select **Claude Code**) |
| **OpenCode** | ✅ Full | `tokenfirefighter setup` (Select **OpenCode**) |
| **OpenAI SDK** | ✅ Full | `tokenfirefighter setup` (Select **OpenAI SDK**) |
| **Ollama** | ✅ Full | `tokenfirefighter setup` (Select **Ollama**) |
| **Continue.dev** | ✅ Full | `tokenfirefighter setup` (Select **Continue.dev**) |
| **Aider** | ✅ Full | `tokenfirefighter setup` (Select **Aider**) |
| **LiteLLM** | ✅ Full | `tokenfirefighter setup` (Select **LiteLLM**) |
| **Jupyter AI** | ⚠️ Partial | Run `export OPENAI_API_BASE=http://localhost:7272/v1` |
| **Continue.dev (self-host)** | ⚠️ Partial | Follow manual settings in [COMPATIBILITY.md](COMPATIBILITY.md) |
| **LocalAI** | ⚠️ Partial | Set API base URL to `http://localhost:7272` |
| **Cursor** | ⚠️ Partial | Go to **Settings** → **OpenAI API base URL** |
| **Cody (Sourcegraph)** | ❌ None | Uses proprietary API, cannot proxy |
| **AWS CodeWhisperer** | ❌ None | Uses IAM-based authentication, cannot intercept |
| **Tabnine** | ❌ None | Uses proprietary endpoints, cannot proxy |
| **Copilot** | ❌ None | Uses GitHub-managed endpoints, cannot intercept |

---

## Step-by-Step Setup

Follow these detailed steps to set up TokenFirefighter on your machine.

### Step 1: Install

First, install the CLI tool globally using `npm`:

```bash
npm install -g tokenfirefighter
```

```text
┌────────────────────────────────────────────────────────────────────────┐
│  TERMINAL                                                              │
│                                                                        │
│  $ npm install -g tokenfirefighter                                     │
│  + tokenfirefighter@1.0.0                                              │
│  added 1 package in 2s                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

### Step 2: Run Setup Wizard

Next, run the interactive setup command to configure your active AI developer tools:

```bash
tokenfirefighter setup
```

#### Step 2a: Choosing a tool
Use your keyboard arrow keys to select the tool you are using (e.g., Kimchi):

```text
┌────────────────────────────────────────────────────────────────────────┐
│  TERMINAL                                                              │
│                                                                        │
│  TokenFirefighter Setup                                                │
│  ──────────────────────                                                │
│  Which AI tool are you using?                                          │
│  > 1) ✅ Kimchi                                                        │
│    2) ✅ Claude Code                                                   │
│    3) ✅ OpenCode                                                      │
│    4) ✅ OpenAI SDK                                                    │
│    5) ✅ Ollama                                                        │
│    6) ✅ Continue.dev                                                  │
│    7) ✅ Aider                                                         │
│    8) ✅ LiteLLM                                                       │
│    9) ⚠️  Jupyter AI                                                   │
│   10) ⚠️  Continue.dev (self-host)                                      │
│   11) ⚠️  LocalAI                                                      │
│   12) ⚠️  Cursor                                                       │
│   13) ❌ Cody (Sourcegraph)                                            │
│   14) ❌ AWS CodeWhisperer                                             │
│   15) ❌ Tabnine                                                       │
│   16) ❌ Copilot                                                       │
│   17) Custom (Other)                                                   │
│                                                                        │
│  Enter selection (1-17): 1                                             │
└────────────────────────────────────────────────────────────────────────┘
```

#### Step 2b: Entering API keys
The wizard automatically configures the tool settings and prompts you to enter your API keys. Your keys are saved securely on your device and are never shared or sent to any server other than the official provider:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  TERMINAL                                                              │
│                                                                        │
│  Configuring Kimchi... ✓                                               │
│  Enter your OpenAI API key: ••••••••                                   │
│  Enter your Anthropic API key: ••••••••                                │
│                                                                        │
│  ✅ Done. Kimchi is protected.                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### Step 3: Starting the proxy

Start the local proxy to begin monitoring requests:

```bash
tokenfirefighter start
```

This starts the proxy and displays the live spending limits dashboard in your terminal:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  TERMINAL                                                              │
│                                                                        │
│  🧯 TokenFirefighter starting on localhost:7272                        │
│  TokenFirefighter proxy listening on 127.0.0.1:7272                    │
│  ╔═══════════════════════════════════════════╗                         │
│  ║  TokenFirefighter v1.0.0   LIVE          ║                         │
│  ╠═══════════════════════════════════════════╣                         │
│  ║  Today:   $0.00 / $50.00             🟢  ║                         │
│  ║  Session: $0.00 / $10.00             🟢  ║                         │
│  ║                                           ║                         │
│  ╠═══════════════════════════════════════════╣                         │
│  ║  Active loops detected: 0                 ║                         │
│  ║                                           ║                         │
│  ║  [12:34 PM] Proxy running...              ║                         │
│  ╚═══════════════════════════════════════════╝                         │
└────────────────────────────────────────────────────────────────────────┘
```

### Step 4: Verifying with doctor

Open a **new terminal tab or window** (keep the proxy running in the first window) and verify the setup:

```bash
tokenfirefighter doctor
```

If everything is routed correctly, the doctor diagnostic tool will show all green checkmarks:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  TERMINAL                                                              │
│                                                                        │
│  TokenFirefighter Doctor                                               │
│  ───────────────────────                                               │
│  Proxy running     ✓ (localhost:7272)                                  │
│  Kimchi setup      ✓ (Configured to use proxy)                         │
│                                                                        │
│  🎉 Everything is configured correctly! You are ready to go.            │
└────────────────────────────────────────────────────────────────────────┘
```

If the proxy server isn't running or the tool is misconfigured, the doctor will display a warning and suggest a solution:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  TERMINAL                                                              │
│                                                                        │
│  TokenFirefighter Doctor                                               │
│  ───────────────────────                                               │
│  Proxy running     ✗ (unreachable)                                     │
│                                                                        │
│  TokenFirefighter proxy is not running. Start it with:                 │
│  tokenfirefighter start                                                │
└────────────────────────────────────────────────────────────────────────┘
```

### Step 5: Seeing the "Protected" message in action

If your tool runs wild and triggers the daily budget or gets stuck in a runaway loop, TokenFirefighter intercepts and blocks it. Your proxy console will show:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  TERMINAL (TokenFirefighter Proxy)                                     │
│                                                                        │
│  ╔═══════════════════════════════════════════╗                         │
│  ║  TokenFirefighter v1.0.0   ALERT!        ║                         │
│  ╠═══════════════════════════════════════════╣                         │
│  ║  Today:   $5.00 / $5.00              🔴  ║                         │
│  ║  Session: $1.00 / $1.00              🔴  ║                         │
│  ║                                           ║                         │
│  ╠═══════════════════════════════════════════╣                         │
│  ║  🚨 [ALERT] DAILY SPEND LIMIT REACHED!    ║                         │
│  ║  🚨 Intercepted and blocked 15 requests   ║                         │
│  ║  🚨 Runaway loop prevented!               ║                         │
│  ╚═══════════════════════════════════════════╝                         │
│  [12:36 PM] 🚨 [BLOCKED] Repeat pattern detected (Layer 1: Hash Match)  │
│  [12:36 PM] 🚨 [BLOCKED] Request blocked to prevent budget drain.      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Verify It's Working

Here is a visual before/after comparison showing how TokenFirefighter intercepts traffic:

**Before TokenFirefighter:**
```bash
$ kimchi
# Sends requests directly to OpenAI — no spend tracking or safeguards.
```

**After TokenFirefighter:**
```bash
$ tokenfirefighter start
Proxy running on http://localhost:7272
[PROXY] Kimchi → OpenAI gpt-4o | $0.0021 | 12:34 PM
[PROXY] Kimchi → OpenAI gpt-4o | $0.0018 | 12:35 PM
📊 Daily spend: $0.89 / $5.00 limit
```

### Architecture Diagram

```text
  ┌──────────┐      ┌─────────────────┐      ┌──────────┐
  │  Kimchi  │ ──►  │ TokenFirefighter │ ──►  │  OpenAI  │
  │  (your   │      │ (proxy + budget  │      │  (API)   │
  │   tool)  │      │  + loop guard)   │      │          │
  └──────────┘      └─────────────────┘      └──────────┘
                          │
                          ▼
                     ┌──────────┐
                     │ SQLite   │
                     │ (spend   │
                     │  log)    │
                     └──────────┘
```

---

## Common Problems & Fixes

Here are simple solutions to common beginner questions:

### "It says my tool is not using TokenFirefighter"

Run the diagnostics check to verify routing:
```bash
tokenfirefighter doctor
tokenfirefighter check kimchi
```
The diagnostic tool will analyze the active tool configurations and print a clear fix message showing you what to modify.

### "I get 'No API key configured'"

If you see API authorization errors, you need to store your keys in the TokenFirefighter credentials vault. Run:
```bash
tokenfirefighter config keys
```
Choose the provider and paste your API key securely. Then restart your AI tool.

### "The proxy starts but my tool can't connect"

Check if a firewall or local network filter is blocking connections on port `7272`. Verify the proxy responds by running:
```bash
curl http://localhost:7272/health
```
You should receive a `{"status":"ok"}` message in response.

### "Can I use multiple tools at once?"

Yes! The local proxy server only needs to run once (`tokenfirefighter start`). Once it is active, run `tokenfirefighter setup` for each tool you wish to configure, and they will all be routed through the single running proxy.

### "How do I uninstall?"

To remove all configuration files, budget databases, and keys, run:
```bash
npm uninstall -g tokenfirefighter
rm -rf ~/.tokenfirefighter
rm -rf ~/.config/tokenfirefighter
```
Be sure to remove any custom base URLs or environment variables from your developer tools (like `OPENAI_API_BASE`) to restore direct connections.

---

## Uninstall

To cleanly remove all TokenFirefighter files and components from your system:

```bash
# 1. Uninstall the CLI package globally
npm uninstall -g tokenfirefighter

# 2. Remove configuration directories and key database files
rm -rf ~/.tokenfirefighter
rm -rf ~/.config/tokenfirefighter
```

Finally, open your AI tool settings and remove custom base URLs or environment variables (e.g. `OPENAI_API_BASE`) so it connects directly to the providers.

---

## Social Media & Sharing

Sharing is caring! Tell other developers about TokenFirefighter:

- **Twitter/Bluesky**: "TokenFirefighter: a free local proxy that stops AI API cost runaway loops. One command to protect Kimchi, Claude Code, and more."
- **Dev.to/Medium**: "How I stopped my AI assistant from accidentally spending $200 in one hour."
