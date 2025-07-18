#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

interface CLIOptions {
  merge: boolean;
  help: boolean;
  template: string;
  markdown: boolean;
  project?: string;
}

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

function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\|/g, '\\|');
}

function saveBase64Image(base64Data: string, mimeType: string, outputDir: string): string {
  const uuid = randomUUID();
  
  // Determine file extension from mime type
  let extension = '.jpg';
  if (mimeType.includes('png')) {
    extension = '.png';
  } else if (mimeType.includes('gif')) {
    extension = '.gif';
  } else if (mimeType.includes('webp')) {
    extension = '.webp';
  } else if (mimeType.includes('svg')) {
    extension = '.svg';
  }
  
  const filename = `${uuid}${extension}`;
  const filepath = path.join(outputDir, filename);
  
  // Create buffer from base64 string
  const buffer = Buffer.from(base64Data, 'base64');
  
  // Save the image file
  fs.writeFileSync(filepath, buffer);
  
  return filename;
}

function formatContentMarkdown(content: string | Array<{ type: string; text?: string; [key: string]: any }>, outputDir?: string): string {
  if (typeof content === 'string') {
    return escapeMarkdown(content);
  }
  
  if (Array.isArray(content)) {
    return content.map(item => {
      if (item.type === 'text' && item.text) {
        return escapeMarkdown(item.text);
      } else if (item.type === 'image' && item.source && item.source.data) {
        if (outputDir) {
          // Save image to file and return relative path
          const filename = saveBase64Image(item.source.data, item.source.media_type || 'image/png', outputDir);
          return `![Image](./${filename})`;
        } else {
          // Fallback to base64 data URL
          return `![Image](data:${item.source.media_type || 'image/png'};base64,${item.source.data})`;
        }
      } else if (item.type === 'tool_use') {
        return `\n**🔧 Tool: ${item.name || 'Unknown'}**\n\n\`\`\`json\n${JSON.stringify(item.input || {}, null, 2)}\n\`\`\`\n`;
      } else if (item.type === 'tool_result') {
        return `\n**📋 Tool Result**\n\n\`\`\`\n${item.content || 'No content'}\n\`\`\`\n`;
      }
      return `\n\`\`\`json\n${JSON.stringify(item, null, 2)}\n\`\`\`\n`;
    }).join('');
  }
  
  return `\n\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\`\n`;
}

function generateMarkdown(entries: SessionEntry[], summary: string, sessionId: string, cwd: string, timestamp: string, outputDir?: string): string {
  const markdownContent = `# ${summary}

**Session ID:** ${sessionId}  
**Working Directory:** ${cwd}  
**Timestamp:** ${new Date(timestamp).toLocaleString()}

---

${entries
  .filter(entry => entry.type === 'user' || entry.type === 'assistant')
  .map(entry => {
    // Check if this is a tool result message (type: user but contains tool_result)
    const hasToolResult = Array.isArray(entry.message?.content) && 
      entry.message.content.some(item => item.type === 'tool_result');
    
    // If it has tool results, treat as assistant message
    const role = hasToolResult ? 'assistant' : (entry.message?.role || entry.type);
    const content = entry.message?.content || '';
    const entryTimestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '';
    
    const roleIcon = role === 'user' ? '👤' : '🤖';
    const formattedContent = formatContentMarkdown(content, outputDir);
    
    return `## ${roleIcon} ${role.toUpperCase()}

*${entryTimestamp}*

${formattedContent}

---
`;
  })
  .join('\n')}`;

  return markdownContent;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    merge: false,
    help: false,
    template: 'default',
    markdown: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--merge') {
      options.merge = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--template') {
      if (i + 1 < args.length) {
        options.template = args[i + 1];
        i++; // Skip the next argument as it's the template name
      } else {
        console.error('Error: --template flag requires a template name');
        process.exit(1);
      }
    } else if (arg === '--project') {
      if (i + 1 < args.length) {
        options.project = args[i + 1];
        i++; // Skip the next argument as it's the project name
      } else {
        console.error('Error: --project flag requires a project name');
        process.exit(1);
      }
    } else if (arg === '--markdown') {
      options.markdown = true;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
ccsession - Export Claude Code sessions to HTML or Markdown

Usage:
  ccsession [options]

Options:
  --merge              Merge all sessions into a single file (chronological order)
  --template <name>    Use template templates/<name>.html (default: default, ignored with --markdown)
  --project <name>     Export sessions from specific project instead of current directory
  --markdown           Output as Markdown instead of HTML
  --help, -h           Show this help message

Examples:
  ccsession                      # Export each session to separate HTML files
  ccsession --merge              # Merge all sessions into one HTML file
  ccsession --template compact   # Use templates/compact.html template
  ccsession --project my-app     # Export sessions from my-app project
  ccsession --markdown           # Export as Markdown files
  ccsession --merge --markdown   # Merge all sessions into one Markdown file

Output directory: /tmp/claude-sessions/
`);
}

function getProjectName(currentDir: string): string {
  return path.basename(currentDir);
}

function exportMergedSessions(sessionFiles: string[], outputDir: string, projectName: string, templateName: string = 'default', isMarkdown: boolean = false): void {
  console.log(`Merging ${sessionFiles.length} sessions chronologically...`);
  
  // Read all sessions and their entries
  const allSessions: { file: string; entries: SessionEntry[]; timestamp: string }[] = [];
  
  for (const sessionFile of sessionFiles) {
    const sessionData = fs.readFileSync(sessionFile, 'utf-8');
    const entries: SessionEntry[] = sessionData
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    // Get the earliest timestamp for this session
    const sessionTimestamp = entries
      .filter(e => e.timestamp)
      .map(e => e.timestamp!)
      .sort()[0] || new Date().toISOString();
    
    allSessions.push({
      file: sessionFile,
      entries,
      timestamp: sessionTimestamp
    });
  }
  
  // Sort sessions by timestamp (oldest first)
  allSessions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  // Merge all entries chronologically
  const allEntries: SessionEntry[] = [];
  const sessionSeparators: string[] = [];
  
  for (let i = 0; i < allSessions.length; i++) {
    const session = allSessions[i];
    const sessionId = path.basename(session.file, '.jsonl');
    
    if (i > 0) {
      // Add session separator
      sessionSeparators.push(`Session ${i + 1}: ${sessionId}`);
    }
    
    allEntries.push(...session.entries);
  }
  
  // Get overall metadata
  const summary = `${projectName} - All Sessions`;
  const timestamp = allSessions[0]?.timestamp || new Date().toISOString();
  const cwd = allSessions[0]?.entries.find(e => e.cwd)?.cwd || 'Unknown';
  
  if (isMarkdown) {
    const markdown = generateMarkdown(allEntries, summary, projectName, cwd, timestamp, outputDir);
    const outputFile = path.join(outputDir, `${projectName}.md`);
    fs.writeFileSync(outputFile, markdown);
    console.log(`Merged session exported to: ${outputFile}`);
  } else {
    const html = generateHTML(allEntries, summary, projectName, cwd, timestamp, templateName, sessionSeparators);
    const outputFile = path.join(outputDir, `${projectName}.html`);
    fs.writeFileSync(outputFile, html);
    console.log(`Merged session exported to: ${outputFile}`);
  }
}

function loadTemplate(templateName: string): string {
  const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, 'utf-8');
}

function generateHTML(entries: SessionEntry[], summary: string, sessionId: string, cwd: string, timestamp: string, templateName: string = 'default', sessionSeparators: string[] = []): string {
  const template = loadTemplate(templateName);
  
  // Generate messages HTML
  const messagesHtml = entries
    .filter(entry => entry.type === 'user' || entry.type === 'assistant')
    .map(entry => {
      // Check if this is a tool result message (type: user but contains tool_result)
      const hasToolResult = Array.isArray(entry.message?.content) && 
        entry.message.content.some(item => item.type === 'tool_result');
      
      // If it has tool results, treat as assistant message
      const role = hasToolResult ? 'assistant' : (entry.message?.role || entry.type);
      const content = entry.message?.content || '';
      const entryTimestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '';
      
      const formattedContent = formatContent(content);
      const iconClass = role === 'user' ? 'user-icon' : (formattedContent.hasTools ? 'wrench-icon' : 'robot-icon');
      
      return `
      <div class="message ${role}">
          <div class="message-header">
              <span class="message-role">
                  <span class="message-icon ${iconClass}"></span>
                  ${role}
              </span>
              <span class="message-timestamp">${entryTimestamp}</span>
          </div>
          <div class="message-content">${formattedContent.html}</div>
      </div>
      `;
    })
    .join('');
  
  // Replace template placeholders
  return template
    .replace('{{TITLE}}', escapeHtml(summary))
    .replace('{{SUMMARY}}', escapeHtml(summary))
    .replace('{{SESSION_ID}}', escapeHtml(sessionId))
    .replace('{{CWD}}', escapeHtml(cwd))
    .replace('{{TIMESTAMP}}', escapeHtml(new Date(timestamp).toLocaleString()))
    .replace('{{MESSAGES}}', messagesHtml);
}

function exportSession(sessionFile: string, outputDir: string, templateName: string = 'default', isMarkdown: boolean = false): void {
  const sessionData = fs.readFileSync(sessionFile, 'utf-8');
  const entries: SessionEntry[] = sessionData
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));

  const sessionId = path.basename(sessionFile, '.jsonl');
  const summary = entries.find(e => e.type === 'summary')?.summary || 'Claude Code Session';
  const timestamp = entries.find(e => e.timestamp)?.timestamp || new Date().toISOString();
  const cwd = entries.find(e => e.cwd)?.cwd || 'Unknown';

  if (isMarkdown) {
    const markdown = generateMarkdown(entries, summary, sessionId, cwd, timestamp, outputDir);
    const outputFile = path.join(outputDir, `${sessionId}.md`);
    fs.writeFileSync(outputFile, markdown);
    console.log(`Exported session to: ${outputFile}`);
  } else {
    const html = generateHTML(entries, summary, sessionId, cwd, timestamp, templateName);
    const outputFile = path.join(outputDir, `${sessionId}.html`);
    fs.writeFileSync(outputFile, html);
    console.log(`Exported session to: ${outputFile}`);
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  const claudeDir = path.join(homedir(), '.claude', 'projects');
  let projectName: string;
  let projectPath: string;
  
  if (options.project) {
    // Use specified project
    projectName = options.project;
    projectPath = path.join(claudeDir, projectName);
    
    if (!fs.existsSync(projectPath)) {
      console.error(`Error: Project '${projectName}' does not exist in .claude/projects`);
      console.error(`Available projects:`);
      
      if (fs.existsSync(claudeDir)) {
        const availableProjects = fs.readdirSync(claudeDir)
          .filter(item => fs.statSync(path.join(claudeDir, item)).isDirectory())
          .sort();
        
        if (availableProjects.length > 0) {
          availableProjects.forEach(project => {
            console.error(`  - ${project}`);
          });
        } else {
          console.error(`  (no projects found)`);
        }
      } else {
        console.error(`  (no .claude/projects directory found)`);
      }
      
      process.exit(1);
    }
    
    console.log(`Looking for Claude sessions in project: ${projectName}`);
  } else {
    // Use current directory
    const currentDir = process.cwd();
    projectName = getProjectName(currentDir);
    
    console.log(`Looking for Claude sessions in: ${projectName}`);
    
    // Convert current directory path to match Claude's folder naming convention
    const projectDirName = currentDir.replace(/\//g, '-');
    projectPath = path.join(claudeDir, projectDirName);
    
    if (!fs.existsSync(projectPath)) {
      console.error(`No Claude sessions found for current directory: ${currentDir}`);
      console.error(`Expected path: ${projectPath}`);
      process.exit(1);
    }
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
  
  console.log(`Found ${sessionFiles.length} session(s) for ${projectName}`);
  
  if (options.merge) {
    exportMergedSessions(sessionFiles, outputDir, projectName, options.template, options.markdown);
  } else {
    const fileType = options.markdown ? 'Markdown' : 'HTML';
    console.log(`Exporting ${sessionFiles.length} individual sessions as ${fileType}...`);
    
    sessionFiles.forEach((sessionFile, index) => {
      try {
        console.log(`   [${index + 1}/${sessionFiles.length}] Processing ${path.basename(sessionFile, '.jsonl')}...`);
        exportSession(sessionFile, outputDir, options.template, options.markdown);
      } catch (error) {
        console.error(`Error exporting ${sessionFile}:`, error);
      }
    });
    
    console.log(`All sessions exported to: ${outputDir}`);
  }
}

if (require.main === module) {
  main();
}