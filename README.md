# ccsession

Export Claude Code sessions to HTML files with improved TUI and merge functionality.

## Usage

```bash
# Export each session to separate HTML files
npx ccsession@latest

# Merge all sessions into one chronological HTML file
npx ccsession@latest --merge

# Show help
npx ccsession@latest --help
```

## Options

- `--merge`: Merge all sessions into a single HTML file, sorted chronologically from oldest to newest
- `--help, -h`: Show help message

## Output

**Individual mode** (default):
- Each session exported to `/tmp/claude-sessions/{session-id}.html`
- Progress indicator shows current session being processed

**Merge mode** (`--merge`):
- All sessions merged into `/tmp/claude-sessions/{project-name}.html`
- Sessions sorted chronologically (oldest first)
- Single comprehensive file with all conversations

## Features

- 🔍 **Smart Discovery**: Automatically finds sessions for current directory
- 📊 **Merge Mode**: Combine all sessions chronologically
- 👤 **User Icons**: User icon for user messages
- 🤖 **Robot Icons**: Robot icon for assistant messages without tool calls
- 🔧 **Wrench Icons**: Wrench icon for assistant messages with tool calls
- 📋 **Collapsible Tools**: Tool outputs with toggle functionality
- 🌙 **Dark Theme**: Compact dark theme design
- 🖼️ **Image Support**: Renders images from sessions
- 📈 **Progress Indicators**: Clear progress feedback
- ✨ **Clean Output**: Readable HTML with proper styling

## How it works

The script looks for Claude Code session files in `~/.claude/projects/` and converts them from JSONL format to styled HTML files. The project name is derived from the current directory name.