const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

const CLAUDE_DIR = path.join(os.homedir(), '.claude', 'projects');

function parseJSONL(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .filter(msg => {
        // メタメッセージと空のメッセージを除外
        if (msg.isMeta) return false;
        if (!msg.message || !msg.message.content) return false;
        
        // ツール結果のみのメッセージも除外（ユーザーメッセージでない限り）
        if (msg.type === 'user' && Array.isArray(msg.message.content)) {
          const hasOnlyToolResults = msg.message.content.every(item => item.type === 'tool_result');
          if (hasOnlyToolResults) return false;
        }
        
        return true;
      });
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return [];
  }
}

function getAllSessions() {
  try {
    const projectDirs = fs.readdirSync(CLAUDE_DIR);
    const sessions = [];
    
    for (const projectDir of projectDirs) {
      const projectPath = path.join(CLAUDE_DIR, projectDir);
      if (!fs.statSync(projectPath).isDirectory()) continue;
      
      const files = fs.readdirSync(projectPath);
      const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
      
      for (const file of jsonlFiles) {
        const sessionId = path.basename(file, '.jsonl');
        const filePath = path.join(projectPath, file);
        const stat = fs.statSync(filePath);
        
        const messages = parseJSONL(filePath);
        const firstMessage = messages.find(m => m.type === 'user');
        
        // 最初のメッセージのコンテンツを安全に取得
        let firstMessageContent = 'No messages';
        if (firstMessage && firstMessage.message && firstMessage.message.content) {
          if (Array.isArray(firstMessage.message.content)) {
            firstMessageContent = firstMessage.message.content[0]?.text || 'No content';
          } else {
            firstMessageContent = firstMessage.message.content;
          }
        }
        
        sessions.push({
          sessionId,
          projectName: projectDir.replace(/C--/g, 'C:\\').replace(/-/g, '\\'),
          lastModified: stat.mtime,
          messageCount: messages.length,
          firstMessage: firstMessageContent,
          filePath
        });
      }
    }
    
    return sessions.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
  } catch (error) {
    console.error('Error getting sessions:', error);
    return [];
  }
}

function getSessionMessages(sessionId) {
  const sessions = getAllSessions();
  const session = sessions.find(s => s.sessionId === sessionId);
  
  if (!session) return null;
  
  const messages = parseJSONL(session.filePath);
  
  // メッセージのコンテンツを安全に取得する関数
  function getMessageContent(msg) {
    if (!msg.message || !msg.message.content) return 'No content';
    
    let content = msg.message.content;
    
    // 配列形式の場合
    if (Array.isArray(content)) {
      let result = [];
      
      for (let item of content) {
        if (item.type === 'text') {
          result.push(item.text);
        } else if (item.type === 'thinking') {
          result.push(`🤔 Thinking: ${item.thinking}`);
        } else if (item.type === 'tool_use') {
          result.push(`🔧 Tool: ${item.name}`);
        } else if (item.type === 'tool_result') {
          if (item.content && item.content.length < 100) {
            result.push(`📋 Result: ${item.content}`);
          } else {
            result.push(`📋 Tool result (${item.is_error ? 'error' : 'success'})`);
          }
        }
      }
      
      return result.length > 0 ? result.join('\n') : 'No content';
    } else {
      // 文字列形式の場合（古い形式）
      return content;
    }
  }
  
  return {
    session,
    messages: messages.map(msg => ({
      id: msg.uuid,
      type: msg.type,
      content: getMessageContent(msg),
      timestamp: msg.timestamp,
      parentUuid: msg.parentUuid
    }))
  };
}

function searchInSessions(query) {
  const sessions = getAllSessions();
  const results = [];
  const queryLower = query.toLowerCase();
  
  for (const session of sessions) {
    const messages = parseJSONL(session.filePath);
    
    for (const msg of messages) {
      let content = '';
      if (msg.message && msg.message.content) {
        if (Array.isArray(msg.message.content)) {
          // 配列内の全ての検索対象コンテンツを結合
          let parts = [];
          for (let item of msg.message.content) {
            if (item.type === 'text' && item.text) {
              parts.push(item.text);
            } else if (item.type === 'thinking' && item.thinking) {
              parts.push(item.thinking);
            } else if (item.type === 'tool_result' && item.content) {
              parts.push(item.content);
            }
          }
          content = parts.join(' ');
        } else {
          content = msg.message.content;
        }
      }
      
      if (content.toLowerCase().includes(queryLower)) {
        results.push({
          sessionId: session.sessionId,
          projectName: session.projectName,
          messageId: msg.uuid,
          type: msg.type,
          content: content.length > 200 ? content.substring(0, 200) + '...' : content,
          timestamp: msg.timestamp
        });
      }
    }
  }
  
  return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

app.get('/api/sessions', (req, res) => {
  const sessions = getAllSessions();
  res.json(sessions);
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const data = getSessionMessages(sessionId);
  
  if (!data) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(data);
});

app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter required' });
  }
  
  const results = searchInSessions(q);
  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Claude Log Viewer running at http://localhost:${PORT}`);
  console.log(`Scanning Claude logs from: ${CLAUDE_DIR}`);
});