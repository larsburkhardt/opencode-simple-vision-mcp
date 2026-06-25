# opencode-simple-vision-mcp — Vision MCP Server for Opencode

Cross-platform MCP server (macOS & Windows) for [OpenCode](https://opencode.ai) that adds vision capabilities — analyze local PNG, JPG, WebP, GIF, HEIC and SVG files via the Google Gemini API.

## Prerequisites

- Node.js ≥ 18
- Google Gemini API key ([aistudio.google.com](https://aistudio.google.com))
- OpenCode running in the terminal

## Setup

```bash
cd ~/opencode-simple-vision-mcp
npm install
cp .env.example .env
```

Edit `.env` and add your API key:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.5-flash
```

## Handshake test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}' \
  | node ~/opencode-simple-vision-mcp/server.mjs 2>/dev/null
```

Expected output: a JSON object with `result.serverInfo.name: "vision"`.

## OpenCode configuration

Find your Node.js path:

```bash
# macOS / Linux
which node
# e.g. /opt/homebrew/bin/node

# Windows (PowerShell)
where node
# e.g. C:\Program Files\nodejs\node.exe
```

Add to `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "vision": {
      "type": "local",
      "command": ["/opt/homebrew/bin/node", "/Users/YOURUSER/opencode-simple-vision-mcp/server.mjs"],
      "enabled": true
    }
  }
}
```

All variables are loaded from `.env` in the project directory.

Replace `/Users/YOURUSER/` with your actual username. Use the full Node.js path from `which node` / `where node` (OpenCode does not inherit the shell PATH).

> **Do NOT use `~` in the `command` array.** Node does not expand tilde — `~/mcp-server/...` will be treated as a literal path and the server will fail to start with `Cannot find module`. Always use the full absolute path (e.g. `/Users/YOURUSER/mcp-server/...` on macOS, `C:\Users\YOURUSER\mcp-server\...` on Windows).

> **nvm users:** The Node path is version-specific (e.g. `/Users/YOURUSER/.nvm/versions/node/v24.14.1/bin/node`). When you update Node via `nvm install`, this path changes and you must update the config. To avoid this, symlink a stable path (e.g. `ln -s "$(which node)" ~/.local/bin/node`) and use `~/.local/bin/node` (or `/usr/local/bin/node` if writable) in the config.

## Usage

```bash
# macOS / Linux
analyze_image /Users/YOURUSER/Desktop/screenshot.png
analyze_image /path/to/image.jpg "What UI elements can you see?"

# Windows
analyze_image C:\Users\YOURUSER\Desktop\screenshot.png
analyze_image C:\path\to\image.jpg "What UI elements can you see?"
```

## Supported formats

| Format | MIME type | Notes |
|--------|-----------|-------|
| PNG | `image/png` | Native |
| JPEG/JPG | `image/jpeg` | Native |
| WebP | `image/webp` | Native |
| GIF | `image/gif` | Native |
| HEIC/HEIF | `image/heic` / `image/heif` | Native |
| SVG | `image/svg+xml` | Converted to PNG via sharp |

## Troubleshooting

**Status `failed` in OpenCode:** Run the handshake test. If you get a JSON response, the issue is the Node.js path in your config. The most common cause is using `~` in the `command` array — Node does not expand tilde, so `["node", "~/mcp-server/.../server.mjs"]` fails with `Cannot find module`. Use absolute paths for both the Node binary and the script.


**`GEMINI_API_KEY` not found:** Make sure `.env` exists in the project directory and contains the key (no quotes around the value).

**404 from Gemini API:** The configured model may be deprecated — set `GEMINI_MODEL` to `gemini-3.5-flash` in `.env`.

**`File not found`:** Always use absolute paths (no `~/` tilde notation). The script resolves `~/Desktop` automatically for generated images.
