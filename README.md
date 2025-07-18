# ccsession

Export Claude Code sessions to HTML files.

## Usage

```bash
npx ccsession@latest
```

This will:
1. Find all Claude Code sessions for the current directory
2. Export them as HTML files to `/tmp/claude-sessions/`
3. Each session will be a standalone HTML file with:
   - User and assistant messages with appropriate icons
   - Collapsible tool outputs
   - Dark theme styling
   - Image support

## Features

- 👤 User icon for user messages
- 🤖 Robot icon for assistant messages without tool calls
- 🔧 Wrench icon for assistant messages with tool calls
- Collapsible tool outputs with toggle functionality
- Dark theme with compact design
- Image rendering support
- Clean, readable HTML output

## How it works

The script looks for Claude Code session files in `~/.claude/projects/` and converts them from JSONL format to styled HTML files.