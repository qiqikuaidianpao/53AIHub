import React, { useState, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { Drawer, Button, Tooltip } from 'antd';
import { EnterOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { t } from '@/locales';
import { XBubbleList, XBubbleUser, XBubbleAssistant } from '@km/hub-ui-x-react';
import ChatChunk, { ChunkRef } from './Chunk';
import ChatQuotation from './Quotation';
import ChatThinkKnowledge, { ThinkKnowledgeRef } from './ThinkKnowledge';
import SpecifiedFiles from '@/components/Chat/SpecifiedFiles';
import { SEARCH_TYPE } from '@/api/modules/feedback/types';
import { getMessageList } from '@/api/modules/feedback/transform';
import { api_host } from '@/utils/config';

export interface DetailRef {
  open: (params: { index: number; tableData: any[]; type: string }) => void;
}

const Detail = forwardRef<DetailRef>((props, ref) => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [curIndex, setCurIndex] = useState<number>(0);
  const [curType, setCurType] = useState<string>('');
  const [list, setList] = useState<any[]>([]);

  const [feedbackInfo, setFeedbackInfo] = useState([
    { label: t('search-feedback.user'), value: '---' },
    { label: t('search-feedback.time'), value: '---' },
    { label: t('search-feedback.feedback_type'), value: '---' },
    { label: t('search-feedback.question_type'), value: '---' },
    { label: t('search-feedback.description'), value: '---' },
  ]);

  const [recordInfo, setRecordInfo] = useState([
    { label: t('search-record.user'), value: '---' },
    { label: t('search-record.time'), value: '---' },
    { label: t('search-record.rewrite'), value: '---' },
  ]);

  const [messageList, setMessageList] = useState<any[]>([]);
  const [showThinkKnowledge, setShowThinkKnowledge] = useState(false);

  const chunkRef = useRef<ChunkRef>(null);
  const thinkKnowledgeRef = useRef<ThinkKnowledgeRef>(null);
  const chunkSourceRef = useRef<any>(null);

  const info = useMemo(() => {
    return curType === SEARCH_TYPE.FEEDBACK ? feedbackInfo : recordInfo;
  }, [curType, feedbackInfo, recordInfo]);

  const loadMessage = (index: number, type: string, tableData: any[]) => {
    const row = tableData[index];
    if (!row) return;

    if (type === SEARCH_TYPE.FEEDBACK) {
      setTitle(row.original_question || '');
      setFeedbackInfo([
        { label: t('search-feedback.user'), value: row.nickname || '---' },
        { label: t('search-feedback.time'), value: row.updated_time || '---' },
        {
          label: t('search-feedback.feedback_type'),
          value: row.feedback_type === 'satisfied' ? t('search-feedback.satisfied') : (row.feedback_type === 'unsatisfied' ? t('search-feedback.unsatisfied') : '---'),
        },
        { label: t('search-feedback.question_type'), value: row.reason || '---' },
        { label: t('search-feedback.description'), value: row.description || '---' },
      ]);
      setMessageList(getMessageList(row.message_info, row.original_question));
    } else if (type === SEARCH_TYPE.RECORD) {
      setTitle(row.original_question || '');
      setRecordInfo([
        { label: t('search-record.user'), value: row.nickname || '---' },
        { label: t('search-record.time'), value: row.updated_time || '---' },
        { label: t('search-record.rewrite'), value: row.rewritten_question || '---' },
      ]);
      setMessageList(getMessageList(row, row.original_question));
    }
  };

  useImperativeHandle(ref, () => ({
    open: ({ index, tableData, type }) => {
      setCurIndex(index);
      setList(tableData);
      setCurType(type);
      loadMessage(index, type, tableData);
      setVisible(true);
    },
  }));

  const handleToPrev = () => {
    const nextIndex = curIndex - 1;
    if (nextIndex >= 0) {
      setCurIndex(nextIndex);
      loadMessage(nextIndex, curType, list);
    }
  };

  const handleToNext = () => {
    const nextIndex = curIndex + 1;
    if (nextIndex < list.length) {
      setCurIndex(nextIndex);
      loadMessage(nextIndex, curType, list);
    }
  };

  const renderSource = (type: string, number: number, message: any) => {
    if (message.rag_stats && message.rag_stats.type === 'web_search') {
      return number.toString();
    }
    return `${type}-${number}`;
  };

  const handleSourceReferenceHover = (data: any, message: any) => {
    const chunks = message.rag_stats?.chunks || [];
    const key = `[Source:${data.sourceType}-${data.sourceNumber}]`;
    const chunk = chunks.find((item: any) => item.source_key === key || item.source === key);
    if (chunk) {
      chunkSourceRef.current = data.element;
      chunkRef.current?.setLibraryInfo(chunk, message.rag_stats?.type);
    } else {
      chunkSourceRef.current = null;
      chunkRef.current?.setLibraryInfo(null, '');
    }
  };

  const handleOpenKnow = (message: any) => {
    setShowThinkKnowledge(true);
    setTimeout(() => {
      thinkKnowledgeRef.current?.updateResults(message.rag_stats?.files_search || [], message.rag_stats?.type || '');
    }, 0);
  };

  const handleFileClick = (file: { id: string | number; file_name?: string; url?: string; preview_key?: string }) => {
    console.log(file);
    if (!file.preview_key) return;
    window.open(api_host + '/api/preview/' + file.preview_key, '_blank');
  };

  // 输出文件下载
  const handleDownloadOutputFile = async (file: { id: string | number; file_name?: string; url?: string }) => {
    if (!file.url) return;
    const token = localStorage.getItem('access_token') || '';
    try {
      const response = await fetch(file.url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`${t('download_failed')}: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.file_name || `文件 ${file.id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error('error', error);
    }
  };

  const closeDrawer = () => {
    setVisible(false);
  };

  const drawerTitle = (
    <div className="w-full text-2xl flex items-center">
      <div className="w-[10%] min-w-fit mr-2">{t('search-record.question')}：</div>
      <Tooltip title={title}>
        <div className="flex-1 truncate font-normal">{title}</div>
      </Tooltip>
    </div>
  );

  return (
    <>
      <Drawer
        title={drawerTitle}
        onClose={closeDrawer}
        open={visible}
        styles={{ wrapper: { width: 890 } }}
        footer={
          <div className="flex justify-end gap-2">
            <Button disabled={curIndex === 0} onClick={handleToPrev}>
              {t('search-feedback.prev')}
            </Button>
            <Button disabled={curIndex === list.length - 1} type="primary" onClick={handleToNext}>
              {t('search-feedback.next')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 mb-7">
          {info.map((item) => (
            <div key={item.label} className="flex w-[270px] text-sm mb-2">
              <span className="w-[60px] text-gray-400 mr-3 shrink-0">{item.label}</span>
              <Tooltip title={item.value}>
                <div className="max-w-[198px] truncate">{item.value}</div>
              </Tooltip>
            </div>
          ))}
        </div>

        <div className="text-base font-medium mb-5">{t('search-feedback.search-detail')}</div>

        <div className="border border-gray-200 rounded-xl py-4 flex flex-col h-[calc(100%-150px)]">
          <XBubbleList messages={messageList} className="flex-1 overflow-y-auto px-4">
            {messageList.map((message, index) => (
              <React.Fragment key={message.id || index}>
                {/* User Message */}
                <XBubbleUser content={message.question} files={message.user_files}>
                  <div className="flex flex-col gap-2 items-end">
                    {/* 指定内容 */}
                    {message.specified_content && (
                      <div className="mb-2">
                        <Tooltip title={message.specified_content}>
                          <div className="max-w-40 h-7 px-2 rounded-lg cursor-pointer text-gray-600 bg-gray-50 hover:bg-gray-200 inline-flex items-center gap-1">
                            <EnterOutlined className="flex-none" />
                            <p className="text-sm truncate m-0">{message.specified_content}</p>
                          </div>
                        </Tooltip>
                      </div>
                    )}
                    <SpecifiedFiles files={[...message.specified_files, ...message.uploaded_files]} type="no_jump" onFileClick={handleFileClick} />
                  </div>
                  {/* 技能标签 */}
                  {message.skill?.display_name && (
                    <span className="bg-[#e6e9f2] rounded py-1 px-2 text-sm">
                      {message.skill.display_name ?? ''}
                    </span>
                  )}
                </XBubbleUser>

                {/* Assistant Message */}
                <XBubbleAssistant
                  content={message.answer}
                  loading={message.loading}
                  error={message.response_status === 2}
                  errorMessage="回答被拒绝"
                  reasoning={message.reasoning_content}
                  reasoningExpanded={message.reasoning_expanded}
                  sourceEnabled={true}
                  renderSource={(type: string, number: number) => renderSource(type, number, message)}
                  onSourceReferenceClick={(data: any) => handleSourceReferenceHover(data, message)}
                >
                  {/* Header part */}
                  {message.rag_stats ? (
                    <div
                      className="h-8 px-2 rounded-lg cursor-pointer bg-gray-100 hover:bg-gray-200 inline-flex items-center mb-3 gap-2"
                      onClick={() => handleOpenKnow(message)}
                    >
                      <p className="text-sm text-gray-800 m-0">
                        {message.rag_stats.type === 'web_search'
                          ? `搜索到${message.rag_stats.files_search?.length || 0}篇网络资料`
                          : `搜索到${message.rag_stats.library_search?.length || 0}个知识库${message.rag_stats.files_search?.length || 0}篇资料`}
                      </p>
                      <ArrowRightOutlined className="text-gray-400 text-xs" />
                    </div>
                  ) : message.loading && message.rag_search_text ? (
                    <div className="h-8 px-2 rounded-lg cursor-pointer bg-gray-100 hover:bg-gray-200 inline-flex items-center mb-3">
                      <p className="flex-1 text-sm text-gray-800 truncate m-0">{message.rag_search_text}</p>
                    </div>
                  ) : null}

                  {/* 输出文件展示 */}
                  {message.outputFiles?.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-3">
                      {message.outputFiles.map((file: any) => (
                        <div
                          key={file.id}
                          className="w-[280px] flex items-center justify-between px-4 py-4 bg-[#f5f7fa] border border-[#E8E8E8] rounded-lg cursor-pointer hover:shadow-sm hover:border-[#D9D9D9] transition-all group"
                          onClick={() => handleDownloadOutputFile(file)}
                        >
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <svg-icon name="file" size="16" className="text-[#666]" />
                            <span className="text-sm text-[#555454] truncate">{file.file_name || `文件 ${file.id}`}</span>
                          </div>
                          <div className="w-20 relative">
                            <img src={`/images/output-file.png`} alt="" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer part */}
                  {message.rag_stats?.file_quotations?.length > 0 && (
                    <div className="mt-3">
                      <ChatQuotation
                        type={message.rag_stats.type}
                        files={message.rag_stats.file_quotations}
                      />
                    </div>
                  )}
                </XBubbleAssistant>
              </React.Fragment>
            ))}
          </XBubbleList>
          <ChatChunk ref={chunkRef} virtualRef={chunkSourceRef} />
        </div>

        {showThinkKnowledge && (
          <ChatThinkKnowledge
            ref={thinkKnowledgeRef}
            onClose={() => setShowThinkKnowledge(false)}
          />
        )}
      </Drawer>
    </>
  );
});

Detail.displayName = 'Detail';

export default Detail;