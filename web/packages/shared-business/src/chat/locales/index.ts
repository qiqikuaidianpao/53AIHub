/**
 * Chat 模块语言包
 */
import { buildMessages, type KeyRow } from '../../locales'

const CHAT_KEYS: readonly KeyRow[] = [
  // 会话相关
  ['chat.new_conversation', '新建会话', '新建會話', 'New conversation', '新しい会話'],
  ['chat.history_conversation', '历史会话', '歷史會話', 'History', '履歴'],
  ['chat.edit_conversation', '重命名会话', '重命名會話', 'Rename conversation', '会話名変更'],
  ['chat.conversation_confirm_delete', '确认删除会话？', '確認刪除會話？', 'Confirm delete conversation?', '会話を削除しますか？'],
  ['chat.conversation_deleted', '会话已删除', '會話已刪除', 'Conversation deleted', '会話が削除されました'],
  ['chat.conversation_title_placeholder', '请输入会话标题', '請輸入會話標題', 'Enter conversation title', '会話タイトルを入力'],
  ['chat.no_title', '无标题', '無標題', 'No title', 'タイトルなし'],
  ['chat.no_description', '暂无描述', '暫無描述', 'No description', '説明なし'],
  // 使用指引相关
  ['chat.usage_guide', '使用指引', '使用指引', 'Usage Guide', '使用ガイド'],
  ['chat.usage_case', '使用案例', '使用案例', 'Use Cases', '使用例'],
  ['chat.usage_scene', '使用场景', '使用場景', 'Usage Scenarios', '使用シーン'],
  ['chat.usage_channel', '使用渠道', '使用渠道', 'Usage Channel', '使用チャンネル'],
  ['chat.input', '输入', '輸入', 'Input', '入力'],
  ['chat.output', '输出', '輸出', 'Output', '出力'],
  ['chat.start_generate', '开始生成', '開始生成', 'Start Generate', '生成開始'],
  ['chat.completion_empty_desc', '采用AI大模型智能生成内容，输入需求即可一键成文，快去试试吧', '執行後查看結果', 'Run to see results', '実行後に結果を表示'],
  ['chat.workflow_error', '工作流错误', '工作流錯誤', 'Workflow error', 'ワークフローエラー'],
  // 消息相关
  ['chat.input_placeholder', '输入消息...', '輸入消息...', 'Type a message...', 'メッセージを入力...'],
  ['chat.send', '发送', '發送', 'Send', '送信'],
  ['chat.stop', '停止', '停止', 'Stop', '停止'],
  ['chat.regenerate', '重新生成', '重新生成', 'Regenerate', '再生成'],
  ['chat.failed_tip', '请求失败', '請求失敗', 'Request failed', 'リクエスト失敗'],
  ['chat.no_available_agent', '暂无可用智能体', '暫無可用智能體', 'No available agent', '利用可能なエージェントなし'],
  ['chat.loading_messages', '加载消息...', '加載消息...', 'Loading messages...', 'メッセージを読み込み中...'],
  ['chat.load_more', '加载更多', '加載更多', 'Load more', 'もっと読み込む'],
  ['chat.no_messages', '暂无消息', '暫無消息', 'No messages', 'メッセージなし'],
  ['chat.ai_disclaimer', '回答内容均由AI生成，仅供参考', '回答內容均由AI生成，僅供參考', 'AI-generated content is for reference only', 'AI生成の内容は参考用です'],
  // 操作
  ['action.del', '删除', '刪除', 'Delete', '削除'],
  ['action.rename', '重命名', '重命名', 'Rename', '名前変更'],
  ['action.cancel', '取消', '取消', 'Cancel', 'キャンセル'],
  ['action.confirm', '确认', '確認', 'Confirm', '確認'],
  ['action.share', '分享', '分享', 'Share', '共有'],
  ['action.copy', '复制', '複製', 'Copy', 'コピー'],
  ['action.copy_markdown', '复制 Markdown', '複製 Markdown', 'Copy Markdown', 'Markdownをコピー'],
  ['action.copy_text', '复制纯文本', '複製純文本', 'Copy plain text', 'プレーンテキストをコピー'],
  ['action.add', '添加', '添加', 'Add', '追加'],
  ['action.add_as_file', '添加为文件', '添加為文件', 'Add as file', 'ファイルとして追加'],
  ['chat.satisfied', '满意', '滿意', 'Satisfied', '満足'],
  ['chat.unsatisfied', '不满意', '不滿意', 'Unsatisfied', '不満'],
  ['action.view', '查看', '查看', 'View', '表示'],
  ['action.delete', '删除', '刪除', 'Delete', '削除'],
  ['action.retry', '重试', '重試', 'Retry', '再試行'],
  ['action.restart', '重新开始', '重新開始', 'Restart', '再開'],
  ['action.copied', '已复制', '已複製', 'Copied', 'コピーしました'],
  ['action.copy_success', '复制成功', '複製成功', 'Copy successful', 'コピー成功'],
  ['action.copy_failed', '复制失败', '複製失敗', 'Copy failed', 'コピー失敗'],
  ['action.click_upload', '点击上传', '點擊上傳', 'Click to upload', 'クリックでアップロード'],
  // 文件相关
  ['file.file_size', '文件大小: ${size}MB', '文件大小: ${size}MB', 'Max file size: ${size}MB', 'ファイルサイズ: ${size}MB'],
  ['file.file_format', '格式: ${format}', '格式: ${format}', 'Format: ${format}', '形式: ${format}'],
  // 错误
  ['error.unknown', '未知错误', '未知錯誤', 'Unknown error', '不明なエラー'],
  ['error.not_found_url', '未找到有效链接', '未找到有效鏈接', 'URL not found', '有効なURLが見つかりません'],
  // Agent 相关
  ['agent.loading', '加载 Agent 信息...', '加載 Agent 信息...', 'Loading agent...', 'エージェントを読み込み中...'],
  ['agent.not_found', '无法获取 Agent 信息', '無法獲取 Agent 信息', 'Agent not found', 'エージェントが見つかりません'],
  ['agent.missing_id', '缺少 agent_id 参数', '缺少 agent_id 参数', 'Missing agent_id', 'agent_id がありません'],
  // 通用
  ['common.no_data', '暂无数据', '暫無數據', 'No data', 'データなし'],
  ['common.language', '语言', '語言', 'Language', '言語'],
  ['common.related_agent', '相关智能体', '相關智能體', 'Related Agents', '関連エージェント'],
  ['related_scene.title', '相关场景', '相關場景', 'Related Scenes', '関連シーン'],
  ['related_scene.next_step', '下一步操作', '下一步操作', 'Next Step', '次のステップ'],
  ['form.input_placeholder', '请输入', '請輸入', 'Please input', '入力してください'],
  // 分享相关
  ['action.select_all', '全选', '全選', 'Select All', '全選'],
  ['action.unselect_all', '取消全选', '取消全選', 'Unselect All', '全選解除'],
  ['action.copy_link', '复制链接', '複製連結', 'Copy Link', 'リンクをコピー'],
  ['share.selected_count', '已选择 ${count} 条消息', '已選擇 ${count} 條消息', 'Selected ${count} messages', '${count}件のメッセージを選択'],
  ['share.create_success', '分享链接已复制', '分享連結已複製', 'Share link copied', '共有リンクをコピーしました'],
  // 技能运行相关
  ['skill.identifying_intent', '正在识别意图...', '正在識別意圖...', 'Identifying intent...', '意図を識別中...'],
  ['skill.loading', '技能加载完成', '技能加載完成', 'Skill loaded', 'スキル読み込み完了'],
  ['skill.thinking', '思考中...', '思考中...', 'Thinking...', '思考中...'],
  ['skill.thinking_complete', '思考完成', '思考完成', 'Thinking complete', '思考完了'],
  ['skill.execute_complete', '执行完成', '執行完成', 'Execution complete', '実行完了'],
  // Openclaw
  ['chat.openclaw_welcome_hint', '现在就在下方输入第一条消息，无需任何繁琐配置，直接开启对话。', '現在就在下方輸入第一條消息，無需任何繁瑣配置，直接開啟對話。', 'Enter your first message below to start the conversation - no setup required.', '最初のメッセージを入力して会話を始めましょう。設定は不要です。'],
  // Timeout
  ['chat.timeout_title', '提示', '提示', 'Notice', 'お知らせ'],
  ['chat.timeout_message', '聊天对话已超时，请创建新对话', '聊天對話已超時，請創建新對話', 'Chat session timed out, please start a new conversation', 'チャットセッションがタイムアウトしました。新しい会話を開始してください。'],
  ['chat.timeout_ok', '全新对话', '全新對話', 'Create New Conversation', '新しい会話を開始'],
]

export const chatMessages = buildMessages(CHAT_KEYS)

export default chatMessages
