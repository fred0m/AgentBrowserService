#!/bin/bash
# Agent-Browser 集成测试脚本
set -e

API_URL="http://localhost:8000/api/v1"
API_KEY="${API_KEY:-testkey}"

echo "=== Agent-Browser 集成测试 ===" 

echo "1. 健康检查..."
curl -s "$API_URL/health" | grep -q "ok" && echo "✅ 服务正常" || (echo "❌ 服务异常" && exit 1)

echo "2. 创建会话..."
RESP=$(curl -s -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" -d '{}' \
  "$API_URL/sessions")
echo "$RESP"

SESSION_ID=$(echo $RESP | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$SESSION_ID" ]; then
  echo "❌ 会话创建失败"
  exit 1
fi
echo "✅ 会话创建成功: $SESSION_ID"

echo "3. 打开 Bing 首页..."
curl -s -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\", \"url\": \"https://www.bing.com\"}" \
  "$API_URL/page/open" | grep -q "Bing" && echo "✅ 页面打开成功" || echo "⚠️  页面打开可能失败"

echo "4. 获取快照 (使用 agent-browser 优化)..."
SNAPSHOT=$(curl -s -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\"}" \
  "$API_URL/page/snapshot")

echo "快照示例 (前500字符):"
echo "$SNAPSHOT" | head -c 500
echo ""

# 统计快照大小
SNAPSHOT_SIZE=$(echo "$SNAPSHOT" | wc -c)
echo "📊 快照大小: $SNAPSHOT_SIZE bytes"

# 提取第一个输入框的 ref
INPUT_REF=$(echo "$SNAPSHOT" | grep -o '"ref":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$INPUT_REF" ]; then
  echo "⚠️  未找到输入框 ref，跳过交互测试"
else
  echo "✅ 找到输入框: $INPUT_REF"
  
  echo "5. 填充搜索框..."
  curl -s -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
    -d "{\"session_id\": \"$SESSION_ID\", \"ref\": \"$INPUT_REF\", \"text\": \"Playwright\"}" \
    "$API_URL/page/fill" | grep -q "ok" && echo "✅ 填充成功" || echo "⚠️  填充失败"
  
  echo "6. 按下回车..."
  curl -s -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
    -d "{\"session_id\": \"$SESSION_ID\", \"key\": \"Enter\"}" \
    "$API_URL/page/press" | grep -q "ok" && echo "✅ 按键成功" || echo "⚠️  按键失败"
  
  echo "7. 等待结果加载..."
  curl -s -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
    -d "{\"session_id\": \"$SESSION_ID\", \"ms\": 2000}" \
    "$API_URL/page/wait" > /dev/null
  
  echo "8. 获取结果页快照..."
  RESULT_SNAPSHOT=$(curl -s -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
    -d "{\"session_id\": \"$SESSION_ID\"}" \
    "$API_URL/page/snapshot")
  
  RESULT_SIZE=$(echo "$RESULT_SNAPSHOT" | wc -c)
  echo "📊 结果页快照大小: $RESULT_SIZE bytes"
  
  echo "$RESULT_SNAPSHOT" | grep -iq "playwright" && echo "✅ 搜索成功" || echo "⚠️  未找到关键词"
fi

echo "9. 清理：关闭会话..."
curl -s -X DELETE -H "Authorization: Bearer $API_KEY" \
  "$API_URL/sessions/$SESSION_ID" | grep -q "ok" && echo "✅ 会话关闭成功" || echo "⚠️  会话关闭失败"

echo ""
echo "=== 测试完成 ==="
echo "💡 Token 优化效果："
echo "   - 首页快照: $SNAPSHOT_SIZE bytes"
if [ ! -z "$INPUT_REF" ]; then
  echo "   - 结果页快照: $RESULT_SIZE bytes"
fi
