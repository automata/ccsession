#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

interface SessionEntry {
  type: 'user' | 'assistant' | 'summary';
  message?: {
    role: 'user' | 'assistant';
    content: string | Array<{ type: string; text?: string; [key: string]: any }>;
  };
  summary?: string;
  timestamp?: string;
  uuid?: string;
  sessionId?: string;
  cwd?: string;
  [key: string]: any;
}

function escapeHtml(text: any): string {
  if (text === null || text === undefined) {
    return '';
  }
  const str = String(text);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatContent(content: string | Array<{ type: string; text?: string; [key: string]: any }>): { html: string; hasTools: boolean } {
  if (typeof content === 'string') {
    return { html: escapeHtml(content), hasTools: false };
  }
  
  if (Array.isArray(content)) {
    let hasTools = false;
    const html = content.map(item => {
      if (item.type === 'text' && item.text) {
        return escapeHtml(item.text);
      } else if (item.type === 'image' && item.source && item.source.data) {
        // Convert base64 image data to img tag
        const mimeType = item.source.media_type || 'image/png';
        const imgSrc = `data:${mimeType};base64,${item.source.data}`;
        return `<div class="image-container">
          <img src="${imgSrc}" alt="Image" class="message-image" />
        </div>`;
      } else if (item.type === 'tool_use') {
        hasTools = true;
        return `<div class="tool-toggle">
          <div class="tool-toggle-header" onclick="toggleTool(this)">
            <span>🔧 Tool: ${escapeHtml(item.name || 'Unknown')}</span>
            <span class="toggle-arrow">▶</span>
          </div>
          <div class="tool-toggle-content">
            <strong>Input:</strong> <pre>${escapeHtml(JSON.stringify(item.input || {}, null, 2))}</pre>
          </div>
        </div>`;
      } else if (item.type === 'tool_result') {
        hasTools = true;
        return `<div class="tool-toggle">
          <div class="tool-toggle-header" onclick="toggleTool(this)">
            <span>📋 Tool Result</span>
            <span class="toggle-arrow">▶</span>
          </div>
          <div class="tool-toggle-content">
            <pre>${escapeHtml(item.content || 'No content')}</pre>
          </div>
        </div>`;
      }
      return `<div class="unknown-content">${escapeHtml(JSON.stringify(item, null, 2))}</div>`;
    }).join('');
    return { html, hasTools };
  }
  
  return { html: escapeHtml(JSON.stringify(content, null, 2)), hasTools: false };
}

function exportSession(sessionFile: string, outputDir: string): void {
  const sessionData = fs.readFileSync(sessionFile, 'utf-8');
  const entries: SessionEntry[] = sessionData
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));

  const sessionId = path.basename(sessionFile, '.jsonl');
  const summary = entries.find(e => e.type === 'summary')?.summary || 'Claude Code Session';
  const timestamp = entries.find(e => e.timestamp)?.timestamp || new Date().toISOString();
  const cwd = entries.find(e => e.cwd)?.cwd || 'Unknown';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(summary)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 12px;
            line-height: 1.4;
            color: #333;
            background: #1a1a1a;
        }
        .session-header {
            border-bottom: 1px solid #333;
            padding-bottom: 12px;
            margin-bottom: 16px;
            color: #fff;
        }
        .session-info {
            background: #2a2a2a;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 12px;
            font-size: 0.85em;
            color: #ccc;
        }
        .message {
            margin-bottom: 12px;
            padding: 8px 12px;
            border-radius: 6px;
            border-left: 3px solid #444;
        }
        .message.user {
            background: #2a2a2a;
            border-left-color: #007bff;
        }
        .message.assistant {
            background: #1e1e1e;
            border-left-color: #28a745;
            border: 1px solid #333;
        }
        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-weight: 600;
            color: #888;
            font-size: 0.85em;
        }
        .message-icon {
            display: inline-block;
            width: 16px;
            height: 16px;
            margin-right: 6px;
            vertical-align: middle;
        }
        .user-icon {
            background: #007bff;
            border-radius: 50%;
            position: relative;
        }
        .user-icon::before {
            content: "👤";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 10px;
            color: white;
        }
        .robot-icon {
            background: #28a745;
            border-radius: 3px;
            position: relative;
        }
        .robot-icon::before {
            content: "🤖";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 10px;
        }
        .wrench-icon {
            background: #ffc107;
            border-radius: 3px;
            position: relative;
        }
        .wrench-icon::before {
            content: "🔧";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 10px;
        }
        .tool-toggle {
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            margin: 6px 0;
            overflow: hidden;
        }
        .tool-toggle-header {
            background: #333;
            padding: 4px 8px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            font-size: 0.8em;
            color: #ccc;
        }
        .tool-toggle-header:hover {
            background: #3a3a3a;
        }
        .tool-toggle-content {
            display: none;
            padding: 8px;
            color: #ddd;
        }
        .tool-toggle-content.show {
            display: block;
        }
        .toggle-arrow {
            transform: rotate(0deg);
            transition: transform 0.2s ease;
        }
        .toggle-arrow.expanded {
            transform: rotate(90deg);
        }
        .message-role {
            text-transform: uppercase;
            font-size: 0.8em;
            letter-spacing: 0.3px;
        }
        .user .message-role {
            color: #007bff;
        }
        .assistant .message-role {
            color: #28a745;
        }
        .message-timestamp {
            font-size: 0.7em;
            color: #666;
        }
        .message-content {
            white-space: pre-wrap;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
            font-size: 0.85em;
            color: #ddd;
            line-height: 1.3;
        }
        .tool-use, .tool-result {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
        }
        .tool-use {
            border-left: 4px solid #ffc107;
        }
        .tool-result {
            border-left: 4px solid #17a2b8;
        }
        pre {
            background: #1a1a1a;
            padding: 6px;
            border-radius: 3px;
            overflow-x: auto;
            font-size: 0.8em;
            color: #ddd;
            margin: 4px 0;
        }
        .unknown-content {
            background: #2a2a1a;
            border: 1px solid #444;
            border-radius: 4px;
            padding: 6px;
            margin: 4px 0;
            color: #ddd;
        }
        .image-container {
            margin: 8px 0;
            text-align: center;
        }
        .message-image {
            max-width: 100%;
            max-height: 400px;
            border-radius: 6px;
            border: 1px solid #444;
            background: #2a2a2a;
        }
    </style>
</head>
<body>
    <div class="session-header">
        <h1>${escapeHtml(summary)}</h1>
        <div class="session-info">
            <div><strong>Session ID:</strong> ${escapeHtml(sessionId)}</div>
            <div><strong>Working Directory:</strong> ${escapeHtml(cwd)}</div>
            <div><strong>Timestamp:</strong> ${escapeHtml(new Date(timestamp).toLocaleString())}</div>
        </div>
    </div>
    
    <div class="messages">
        ${entries
          .filter(entry => entry.type === 'user' || entry.type === 'assistant')
          .map(entry => {
            // Check if this is a tool result message (type: user but contains tool_result)
            const hasToolResult = Array.isArray(entry.message?.content) && 
              entry.message.content.some(item => item.type === 'tool_result');
            
            // If it has tool results, treat as assistant message
            const role = hasToolResult ? 'assistant' : (entry.message?.role || entry.type);
            const content = entry.message?.content || '';
            const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '';
            
            const formattedContent = formatContent(content);
            const iconClass = role === 'user' ? 'user-icon' : (formattedContent.hasTools ? 'wrench-icon' : 'robot-icon');
            
            return `
            <div class="message ${role}">
                <div class="message-header">
                    <span class="message-role">
                        <span class="message-icon ${iconClass}"></span>
                        ${role}
                    </span>
                    <span class="message-timestamp">${timestamp}</span>
                </div>
                <div class="message-content">${formattedContent.html}</div>
            </div>
            `;
          })
          .join('')}
    </div>
    <script>
        function toggleTool(header) {
            const content = header.nextElementSibling;
            const arrow = header.querySelector('.toggle-arrow');
            
            if (content.classList.contains('show')) {
                content.classList.remove('show');
                arrow.classList.remove('expanded');
            } else {
                content.classList.add('show');
                arrow.classList.add('expanded');
            }
        }
    </script>
</body>
</html>`;

  const outputFile = path.join(outputDir, `${sessionId}.html`);
  fs.writeFileSync(outputFile, html);
  console.log(`Exported session to: ${outputFile}`);
}

function main(): void {
  const currentDir = process.cwd();
  const claudeDir = path.join(homedir(), '.claude', 'projects');
  
  // Convert current directory path to match Claude's folder naming convention
  const projectDirName = currentDir.replace(/\//g, '-');
  const projectPath = path.join(claudeDir, projectDirName);
  
  if (!fs.existsSync(projectPath)) {
    console.error(`No Claude sessions found for current directory: ${currentDir}`);
    console.error(`Expected path: ${projectPath}`);
    process.exit(1);
  }
  
  const outputDir = '/tmp/claude-sessions';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const sessionFiles = fs.readdirSync(projectPath)
    .filter(file => file.endsWith('.jsonl'))
    .map(file => path.join(projectPath, file));
  
  if (sessionFiles.length === 0) {
    console.error(`No session files found in: ${projectPath}`);
    process.exit(1);
  }
  
  console.log(`Found ${sessionFiles.length} session(s) for ${currentDir}`);
  
  sessionFiles.forEach(sessionFile => {
    try {
      exportSession(sessionFile, outputDir);
    } catch (error) {
      console.error(`Error exporting ${sessionFile}:`, error);
    }
  });
  
  console.log(`All sessions exported to: ${outputDir}`);
}

if (require.main === module) {
  main();
}