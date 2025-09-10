// グローバル変数
let sessions = [];
let currentSessionId = null;
let searchModal = null;

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    searchModal = new bootstrap.Modal(document.getElementById('searchModal'));
    loadSessions();
    setupEventListeners();
});

// イベントリスナーの設定
function setupEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', loadSessions);
    document.getElementById('searchBtn').addEventListener('click', performSearch);
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

// セッション一覧を読み込み
async function loadSessions() {
    try {
        const response = await fetch('/api/sessions');
        sessions = await response.json();
        renderSessionList();
    } catch (error) {
        console.error('Error loading sessions:', error);
        showError('セッションの読み込みに失敗しました');
    }
}

// セッション一覧をレンダリング
function renderSessionList() {
    const sessionList = document.getElementById('sessionList');
    
    if (sessions.length === 0) {
        sessionList.innerHTML = `
            <div class="text-center p-3 text-muted">
                <i class="bi bi-inbox"></i>
                <p class="mt-2">会話セッションが見つかりません</p>
            </div>
        `;
        return;
    }
    
    const html = sessions.map(session => `
        <div class="session-item" data-session-id="${session.sessionId}">
            <div class="session-title">${formatProjectName(session.projectName)}</div>
            <div class="session-preview">${session.firstMessage}</div>
            <div class="session-meta">
                <span><i class="bi bi-chat"></i> ${session.messageCount}</span>
                <span>${formatDate(session.lastModified)}</span>
            </div>
        </div>
    `).join('');
    
    sessionList.innerHTML = html;
    
    // クリックイベントを追加
    sessionList.addEventListener('click', function(e) {
        const sessionItem = e.target.closest('.session-item');
        if (sessionItem) {
            selectSession(sessionItem.dataset.sessionId);
        }
    });
}

// セッション選択
async function selectSession(sessionId) {
    try {
        // アクティブ状態を更新
        document.querySelectorAll('.session-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-session-id="${sessionId}"]`).classList.add('active');
        
        // 会話を読み込み
        const response = await fetch(`/api/sessions/${sessionId}`);
        const data = await response.json();
        
        currentSessionId = sessionId;
        renderConversation(data);
    } catch (error) {
        console.error('Error loading conversation:', error);
        showError('会話の読み込みに失敗しました');
    }
}

// 会話をレンダリング
function renderConversation(data) {
    const header = document.getElementById('conversationHeader');
    const body = document.getElementById('conversationBody');
    
    header.innerHTML = `
        <h5 class="mb-0">${formatProjectName(data.session.projectName)}</h5>
        <small class="text-muted">
            ${data.messages.length} messages • ${formatDate(data.session.lastModified)}
        </small>
    `;
    
    const messagesHtml = data.messages.map(message => `
        <div class="message message-${message.type}">
            <div class="message-content">
                <div class="message-text">${formatMessageContent(message.content)}</div>
                <div class="message-timestamp">${formatTime(message.timestamp)}</div>
            </div>
        </div>
    `).join('');
    
    body.innerHTML = `<div class="conversation-area">${messagesHtml}</div>`;
    
    // 最新のメッセージまでスクロール
    const conversationArea = body.querySelector('.conversation-area');
    conversationArea.scrollTop = conversationArea.scrollHeight;
}

// 検索実行
async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const results = await response.json();
        renderSearchResults(results, query);
        searchModal.show();
    } catch (error) {
        console.error('Error performing search:', error);
        showError('検索に失敗しました');
    }
}

// 検索結果をレンダリング
function renderSearchResults(results, query) {
    const searchResults = document.getElementById('searchResults');
    
    if (results.length === 0) {
        searchResults.innerHTML = `
            <div class="text-center p-3 text-muted">
                <i class="bi bi-search"></i>
                <p class="mt-2">"${query}" に一致する結果が見つかりません</p>
            </div>
        `;
        return;
    }
    
    const html = results.map(result => `
        <div class="search-result-item" data-session-id="${result.sessionId}">
            <div class="search-result-content">${highlightSearchTerm(result.content, query)}</div>
            <div class="search-result-meta">
                <span class="text-primary">${formatProjectName(result.projectName)}</span>
                <span>${formatDate(result.timestamp)}</span>
            </div>
        </div>
    `).join('');
    
    searchResults.innerHTML = html;
    
    // クリックイベントを追加
    searchResults.addEventListener('click', function(e) {
        const resultItem = e.target.closest('.search-result-item');
        if (resultItem) {
            searchModal.hide();
            selectSession(resultItem.dataset.sessionId);
        }
    });
}

// ユーティリティ関数
function formatProjectName(projectName) {
    return projectName.split('\\').pop() || 'Unknown Project';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
        return '今日';
    } else if (days === 1) {
        return '昨日';
    } else if (days < 7) {
        return `${days}日前`;
    } else {
        return date.toLocaleDateString('ja-JP');
    }
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatMessageContent(content) {
    if (!content) return '';
    
    // HTMLエスケープ
    const escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // 改行を<br>に変換
    return escaped.replace(/\n/g, '<br>');
}

function highlightSearchTerm(text, term) {
    if (!term) return formatMessageContent(text);
    
    const escaped = formatMessageContent(text);
    const regex = new RegExp(`(${term})`, 'gi');
    return escaped.replace(regex, '<span class="search-highlight">$1</span>');
}

function showError(message) {
    // 簡単なエラー表示（実際の実装では toast や alert を使用）
    console.error(message);
    alert(message);
}