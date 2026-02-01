# HTTP API 文档

Base URL: `http://<host>:8000/api/v1`
Auth: `Authorization: Bearer <API_KEY>`

## 系统
### 健康检查
`GET /health`
- 无需鉴权
- 响应: `{"ok": true}`

## 会话管理 (Session)

### 创建会话
`POST /sessions`
- 响应:
```json
{
  "ok": true,
  "session_id": "s_1234abcd"
}
```
- 错误: 429 (并发超限), 500

### 关闭会话
`DELETE /sessions/{session_id}`
- 响应: `{"ok": true}`
- 错误: 404 (不存在)

## 页面交互 (Page)

### 打开页面
`POST /page/open`
- Body:
```json
{
  "session_id": "s_1234abcd",
  "url": "https://example.com"
}
```
- 响应:
```json
{
  "ok": true,
  "url": "https://example.com/",
  "title": "Example Domain"
}
```

### 获取快照 (Snapshot)
`POST /page/snapshot`
- Body:
```json
{
  "session_id": "s_1234abcd",
  "mode": "compact"  // 可选: compact, text_only, actions_only
}
```
- 响应 (Compact):
```json
{
  "session_id": "s_1234abcd",
  "title": "Page Title",
  "url": "https://...",
  "meta": { "truncated": false, "actions_truncated": false },
  "main_text": "页面主要文本内容...",
  "actions": [
    { "ref": "a1", "type": "link", "label": "About", "hint": "https://..." },
    { "ref": "i1", "type": "input", "label": "Search", "hint": "" }
  ]
}
```

### 点击元素
`POST /page/click`
- Body:
```json
{
  "session_id": "s_1234abcd",
  "ref": "a1"
}
```
- 响应: `{"ok": true}`

### 填充文本
`POST /page/fill`
- Body:
```json
{
  "session_id": "s_1234abcd",
  "ref": "i1",
  "text": "Hello World"
}
```
- 响应: `{"ok": true}`

### 按键
`POST /page/press`
- Body:
```json
{
  "session_id": "s_1234abcd",
  "key": "Enter"
}
```
- 响应: `{"ok": true}`

### 等待
`POST /page/wait`
- Body:
```json
{
  "session_id": "s_1234abcd",
  "ms": 1000
}
```
- 响应: `{"ok": true}`
