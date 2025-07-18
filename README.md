# ccsession

Export Claude Code sessions to HTML or Markdown files, useful to share with peers and
understand which tools are called by CC.

## Usage

```bash
# Export each session to separate HTML files
npx ccsession@latest

# Merge all sessions into one chronological HTML file
npx ccsession@latest --merge

# Export as Markdown files
npx ccsession@latest --markdown

# Use a specific template
npx ccsession@latest --template light

# Export from a specific project
npx ccsession@latest --project my-app

# Combine options
npx ccsession@latest --merge --markdown --project my-app

# Show help
npx ccsession@latest --help
```

## Options

- `--merge`: Merge all sessions into a single file, sorted chronologically from oldest to newest
- `--template <name>`: Use template `templates/<name>.html` (default: default, ignored with --markdown)
- `--project <name>`: Export sessions from specific project instead of current directory
- `--markdown`: Output as Markdown instead of HTML
- `--help, -h`: Show help message

## Templates

Available HTML templates:
- `default`: Dark theme with collapsible tool outputs
- `light`: Light theme variant
- `compact`: Compact monospace theme

## Output

**Individual mode** (default):
- HTML: Each session exported to `/tmp/claude-sessions/{session-id}.html`
- Markdown: Each session exported to `/tmp/claude-sessions/{session-id}.md`
- Progress indicator shows current session being processed

**Merge mode** (`--merge`):
- HTML: All sessions merged into `/tmp/claude-sessions/{project-name}.html`
- Markdown: All sessions merged into `/tmp/claude-sessions/{project-name}.md`
- Sessions sorted chronologically (oldest first)
- Single comprehensive file with all conversations

**Markdown mode** (`--markdown`):
- Images are extracted from base64 and saved as separate files
- Image files are linked relatively in the markdown (e.g., `![Image](./uuid.png)`)
- Supports proper formatting for tool outputs and code blocks

## Features

- **Smart Discovery**: Automatically finds sessions for current directory or specified project
- **Merge Mode**: Combine all sessions chronologically
- **Template System**: Multiple HTML themes available
- **Markdown Export**: Full markdown support with image extraction
- **Project Selection**: Export from any project in .claude/projects
- **Image Handling**: Automatic base64 image extraction and file linking in markdown mode

## How it works

The script looks for Claude Code session files in `~/.claude/projects/` and converts them from JSONL format to styled HTML or Markdown files. By default, it uses the current directory name to find the matching project, but you can specify any project with the `--project` flag.