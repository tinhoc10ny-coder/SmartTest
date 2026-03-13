
import React, { useState, useMemo, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, TextRun } from "docx";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { 
  Settings, 
  BookOpen, 
  BarChart3, 
  Layout, 
  Plus, 
  Trash2,
  Sparkles, 
  FileDown,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  X,
  Edit2,
  RefreshCw,
  CheckCircle2,
  Save,
  Undo2,
  ChevronLeft,
  FileText,
  Info,
  Loader2,
  FolderOpen,
  Download,
  Maximize,
  Minimize,
  Minus,
  ImagePlus,
  Eye,
  ClipboardList,
  Check,
  Square
} from 'lucide-react';
import { 
  TestConfig, 
  QuestionType, 
  Difficulty, 
  GeneratedTest, 
  GeneratedQuestion
} from './types';
import { generateTest, getTopicSuggestions, generateIllustration, parseExistingTest } from './services/geminiService';

// Helper to strip redundant labels like "A. ", "B. ", "1. ", "a) " from content
const stripPrefix = (text: string) => {
  return text.replace(/^[A-ZĐSa-z0-9][.)]\s*/, '').trim();
};

const MathRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="markdown-body">
      <ReactMarkdown 
        remarkPlugins={[remarkMath]} 
        rehypePlugins={[rehypeKatex]}
        components={{
          img: ({node, ...props}) => (
            <img 
              {...props} 
              style={{ maxWidth: '100%', height: 'auto', borderRadius: '0.75rem', margin: '0.75rem 0', display: 'block' }} 
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

const QuestionRenderer: React.FC<{ 
  question: GeneratedQuestion; 
  displayId?: number | string;
  subject: string;
  onUpdate: (updated: GeneratedQuestion) => void;
  onDelete: (id: number) => void;
  onRequestApiSetup: () => void;
  hideControls?: boolean;
}> = ({ question, displayId, subject, onUpdate, onDelete, onRequestApiSetup, hideControls = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isIllustrating, setIsIllustrating] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState<GeneratedQuestion>(JSON.parse(JSON.stringify(question)));

  useEffect(() => {
    if (!isEditing) {
      setEditedQuestion(JSON.parse(JSON.stringify(question)));
    }
  }, [question, isEditing]);

  const handleSave = () => {
    onUpdate(editedQuestion);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedQuestion(JSON.parse(JSON.stringify(question)));
    setIsEditing(false);
  };

  const handleGenerateImage = async () => {
    setIsIllustrating(true);
    try {
      const imageUrl = await generateIllustration(editedQuestion.content, subject);
      if (imageUrl) {
        const updated = { ...editedQuestion, imageUrl };
        setEditedQuestion(updated);
        onUpdate(updated);
      } else {
        alert("Không thể tạo hình minh họa. Vui lòng thử lại sau.");
      }
    } catch (error: any) {
      console.error("Lỗi tạo ảnh minh họa:", error);
      if (error?.message?.includes("Requested entity was not found") || error?.message?.includes("API_KEY_INVALID")) {
        alert("API Key không hợp lệ. Vui lòng thiết lập lại trong phần Cài đặt API.");
        onRequestApiSetup();
      } else {
        alert("Không thể tạo hình minh họa. Vui lòng thử lại sau.");
      }
    }
    setIsIllustrating(false);
  };

  const updateSubItem = (idx: number, value: string) => {
    const newSubItems = [...(editedQuestion.subItems || [])];
    newSubItems[idx] = value;
    setEditedQuestion({ ...editedQuestion, subItems: newSubItems });
  };

  const updateOption = (idx: number, value: string) => {
    const newOptions = [...(editedQuestion.options || [])];
    newOptions[idx] = value;
    setEditedQuestion({ ...editedQuestion, options: newOptions });
  };

  const updateAnswer = (idx: number, value: string) => {
    const currentAnswers = Array.isArray(editedQuestion.answer) ? [...editedQuestion.answer] : [editedQuestion.answer];
    currentAnswers[idx] = value;
    setEditedQuestion({ ...editedQuestion, answer: currentAnswers });
  };

  const toggleLockShuffle = () => {
    const updated = { ...editedQuestion, lockShuffle: !editedQuestion.lockShuffle };
    setEditedQuestion(updated);
    onUpdate(updated);
  };

  const toggleLockOption = (idx: number) => {
    const length = editedQuestion.options?.length || editedQuestion.subItems?.length || 0;
    const newLocks = [...(editedQuestion.lockOptions || new Array(length).fill(false))];
    newLocks[idx] = !newLocks[idx];
    const updated = { ...editedQuestion, lockOptions: newLocks };
    setEditedQuestion(updated);
    onUpdate(updated);
  };

  const handleImagePaste = async (e: React.ClipboardEvent, setter: (val: string) => void, currentVal: string) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const markdownImage = `\n\n![image](${base64})\n\n`;
            
            const target = e.target as HTMLTextAreaElement | HTMLInputElement;
            const start = target.selectionStart || 0;
            const end = target.selectionEnd || 0;
            const newVal = currentVal.substring(0, start) + markdownImage + currentVal.substring(end);
            setter(newVal);
            
            setTimeout(() => {
              target.focus();
              target.setSelectionRange(start + markdownImage.length, start + markdownImage.length);
            }, 0);
          };
          reader.readAsDataURL(file);
          return true;
        }
      }
    }
    return false;
  };

  const renderMCQ = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-1 mt-3">
      {editedQuestion.options?.map((opt, oi) => {
        const char = String.fromCharCode(65 + oi);
        const answersArray = Array.isArray(editedQuestion.answer) ? editedQuestion.answer : [editedQuestion.answer];
        const isCorrect = answersArray[0] === char;
        const displayOpt = isEditing ? opt : stripPrefix(opt);
        const isLocked = editedQuestion.lockOptions?.[oi];

        return (
          <div key={oi} className={`flex items-start gap-3 p-3 border-2 rounded-xl text-sm transition shadow-sm ${isCorrect ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-600/20' : 'bg-white border-slate-300 text-slate-900'}`}>
            <button 
              disabled={!isEditing}
              onClick={() => isEditing && setEditedQuestion({...editedQuestion, answer: [char]})}
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 transition ${isCorrect ? 'bg-emerald-700 text-white shadow-lg' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
            >
              {char}
            </button>
            {isEditing ? (
              <input 
                value={opt} 
                onChange={(e) => updateOption(oi, e.target.value)}
                onPaste={(e) => handleImagePaste(e, (val) => updateOption(oi, val), opt)}
                className="flex-1 bg-transparent border-b-2 border-emerald-400 outline-none focus:border-emerald-700 text-emerald-900 font-black"
              />
            ) : (
              <div className={isCorrect ? 'font-black text-emerald-900 text-base' : 'font-bold text-base text-slate-800'}>
                <MathRenderer content={displayOpt} />
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {isCorrect && !isEditing && <CheckCircle2 size={22} className="text-emerald-700" />}
              {!isEditing && !hideControls && (
                <button 
                  onClick={() => toggleLockOption(oi)}
                  className={`p-1.5 rounded-lg transition-all ${isLocked ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-emerald-600 text-white shadow-sm'}`}
                  title={isLocked ? "Đã khóa vị trí" : "Cho phép trộn vị trí"}
                >
                  <RefreshCw size={14} className={isLocked ? "" : "animate-spin-slow"} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderTF = () => (
    <div className="space-y-3 pl-1 mt-3">
      <div className="grid grid-cols-12 gap-2 text-[11px] font-black text-slate-800 uppercase tracking-[0.1em] px-4 mb-1">
        <div className="col-span-10">Phát biểu kiểm tra (a, b, c, d)</div>
        <div className="col-span-2 text-center">Đ / S</div>
      </div>
      {(editedQuestion.subItems || []).map((item, idx) => {
        const char = String.fromCharCode(97 + idx);
        const answersArray = Array.isArray(editedQuestion.answer) ? editedQuestion.answer : [editedQuestion.answer];
        const ans = answersArray[idx] || '';
        const isTrue = ans.toLowerCase().includes('đúng') || ans.toLowerCase().startsWith('đ') || ans.toLowerCase().startsWith('t');
        const displayItem = isEditing ? item : stripPrefix(item);
        const isLocked = editedQuestion.lockOptions?.[idx];

        return (
          <div key={idx} className="grid grid-cols-12 items-center gap-2 p-3 bg-white border-2 border-slate-200 rounded-xl hover:border-emerald-500 transition shadow-sm group/item">
            <div className="col-span-1 text-xs font-black text-slate-600">{char})</div>
            <div className="col-span-8">
              {isEditing ? (
                <input 
                  value={item} 
                  onChange={(e) => updateSubItem(idx, e.target.value)}
                  onPaste={(e) => handleImagePaste(e, (val) => updateSubItem(idx, val), item)}
                  className="w-full bg-transparent border-b-2 border-emerald-300 outline-none text-sm text-slate-900 font-black"
                />
              ) : (
                <div className="text-sm text-slate-900 font-black leading-relaxed">
                  <MathRenderer content={displayItem} />
                </div>
              )}
            </div>
            <div className="col-span-3 flex items-center justify-center gap-2">
              <button
                disabled={!isEditing}
                onClick={() => isEditing && updateAnswer(idx, isTrue ? 'Sai' : 'Đúng')}
                className={`w-10 py-2 rounded-lg text-xs font-black border-2 transition shadow-md ${isTrue ? 'bg-emerald-600 border-emerald-900 text-white' : 'bg-rose-600 border-rose-900 text-white'}`}
              >
                {isTrue ? 'Đ' : 'S'}
              </button>
              {!isEditing && !hideControls && (
                <button 
                  onClick={() => toggleLockOption(idx)}
                  className={`p-1.5 rounded-lg transition-all ${isLocked ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-emerald-600 text-white shadow-sm'}`}
                  title={isLocked ? "Đã khóa vị trí" : "Cho phép trộn vị trí"}
                >
                  <RefreshCw size={14} className={isLocked ? "" : "animate-spin-slow"} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSA = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-1 mt-3">
      {(editedQuestion.subItems || []).map((item, idx) => {
        const char = String.fromCharCode(97 + idx);
        const answersArray = Array.isArray(editedQuestion.answer) ? editedQuestion.answer : [editedQuestion.answer];
        const ans = answersArray[idx] || '';
        const displayItem = isEditing ? item : stripPrefix(item);
        const isLocked = editedQuestion.lockOptions?.[idx];

        return (
          <div key={idx} className="p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl space-y-3 shadow-sm hover:border-emerald-400 transition">
            <div className="text-[11px] font-black text-slate-800 uppercase flex items-center justify-between tracking-widest">
              <div className="flex items-center gap-2">
                Ý thành phần {char}:
                {!isEditing && !hideControls && (
                  <button 
                    onClick={() => toggleLockOption(idx)}
                    className={`p-1 rounded-lg transition-all ${isLocked ? 'bg-slate-200 text-slate-400' : 'bg-emerald-600 text-white shadow-sm'}`}
                    title={isLocked ? "Đã khóa vị trí" : "Cho phép trộn vị trí"}
                  >
                    <RefreshCw size={12} className={isLocked ? "" : "animate-spin-slow"} />
                  </button>
                )}
              </div>
              {isEditing && (
                <input 
                  value={item} 
                  onChange={(e) => updateSubItem(idx, e.target.value)}
                  onPaste={(e) => handleImagePaste(e, (val) => updateSubItem(idx, val), item)}
                  placeholder="Mô tả ý hỏi..."
                  className="ml-2 flex-1 bg-white px-2 py-1 rounded-lg border border-slate-400 outline-none text-[10px] font-black shadow-inner"
                />
              )}
            </div>
            {!isEditing && <div className="text-sm text-slate-900 mb-1 font-black leading-snug"><MathRenderer content={displayItem} /></div>}
            {isEditing ? (
              <input 
                value={ans} 
                onChange={(e) => updateAnswer(idx, e.target.value)}
                placeholder="Đáp án ngắn..."
                className="w-full text-sm font-black text-emerald-900 bg-white px-4 py-2 rounded-xl border-2 border-emerald-400 outline-none focus:border-emerald-700 shadow-inner"
              />
            ) : (
              <div className="text-sm font-black text-emerald-900 bg-emerald-100 px-4 py-2 rounded-xl border-2 border-emerald-400 shadow-sm">
                <MathRenderer content={ans} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderTL = () => {
    const answersArray = Array.isArray(editedQuestion.answer) ? editedQuestion.answer : [editedQuestion.answer];
    return (
      <div className="pl-1 mt-3">
        <div className="p-6 bg-emerald-50 border-2 border-emerald-300 rounded-2xl shadow-sm">
          <div className="text-[11px] font-black text-emerald-900 uppercase mb-3 tracking-[0.1em]">Hướng dẫn chấm & Đáp án chi tiết:</div>
          {isEditing ? (
            <div className="relative group/editor">
              <textarea 
                value={answersArray[0]} 
                onChange={(e) => setEditedQuestion({...editedQuestion, answer: [e.target.value]})}
                onPaste={(e) => handleImagePaste(e, (val) => setEditedQuestion(prev => ({...prev, answer: [val]})), answersArray[0])}
                placeholder="Nhập hướng dẫn chấm (Hỗ trợ LaTeX và dán ảnh từ clipboard)..."
                className="w-full bg-white border border-emerald-500 rounded-xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-100 min-h-[140px] text-slate-900 shadow-inner"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-tighter opacity-0 group-hover/editor:opacity-100 transition shadow-sm pointer-events-none">
                <FolderOpen size={10} />
                Có thể dán ảnh (Ctrl+V)
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-900 font-black leading-relaxed italic whitespace-pre-wrap">
              <MathRenderer content={answersArray[0]} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`group relative space-y-4 p-6 rounded-3xl transition-all border-2 shadow-sm ${isEditing ? 'bg-emerald-50/20 border-emerald-600 shadow-xl scale-[1.01]' : 'bg-white border-slate-300 hover:border-emerald-500'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 bg-slate-950 text-white rounded-xl flex items-center justify-center text-lg font-black shadow-lg ring-2 ring-slate-100">
            {displayId || question.id}
          </span>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-slate-200 border border-slate-400 text-slate-900 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm">
              {editedQuestion.type}
            </span>
            {isEditing ? (
               <select 
                value={editedQuestion.level} 
                onChange={(e) => setEditedQuestion({...editedQuestion, level: e.target.value})}
                className="px-3 py-1 bg-white border border-emerald-600 text-emerald-900 rounded-full text-[10px] font-black uppercase outline-none shadow-md"
               >
                 <option>Nhận biết</option>
                 <option>Thông hiểu</option>
                 <option>Vận dụng</option>
               </select>
            ) : (
              <span className="px-3 py-1 bg-emerald-100 border border-emerald-500 text-emerald-900 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm">
                {editedQuestion.level}
              </span>
            )}
            <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm italic">
              Chủ đề: {editedQuestion.topic || 'Chưa phân loại'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          {!isEditing && !hideControls && (
            <button 
              onClick={toggleLockShuffle}
              className={`p-2.5 rounded-xl transition-all border-2 ${editedQuestion.lockShuffle ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-emerald-600 text-white border-emerald-700 shadow-md'}`}
              title={editedQuestion.lockShuffle ? "Đã khóa vị trí câu hỏi" : "Cho phép trộn vị trí câu hỏi"}
            >
              <RefreshCw size={20} className={editedQuestion.lockShuffle ? "" : "animate-spin-slow"} />
            </button>
          )}
          {isEditing ? (
            <>
              <button onClick={handleSave} title="Lưu" className="p-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition shadow-lg active:scale-90 border border-emerald-900"><Save size={20} /></button>
              <button onClick={handleCancel} title="Hủy" className="p-2.5 bg-slate-100 text-slate-900 rounded-xl border border-slate-400 hover:bg-slate-200 transition shadow-sm active:scale-90"><Undo2 size={20} /></button>
            </>
          ) : (
            <>
              {!hideControls && (
                <button 
                  onClick={handleGenerateImage} 
                  disabled={isIllustrating}
                  title="Tạo ảnh minh họa AI" 
                  className="p-2.5 bg-white border border-emerald-400 text-emerald-800 hover:bg-emerald-50 rounded-xl transition shadow-md active:scale-90 flex items-center gap-2"
                >
                  {isIllustrating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                  <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Minh họa AI</span>
                </button>
              )}
              {!hideControls && <button onClick={() => setIsEditing(true)} title="Sửa" className="p-2.5 text-slate-900 hover:text-emerald-900 hover:bg-emerald-50 rounded-xl transition shadow-sm bg-slate-100 border border-slate-300 active:scale-90"><Edit2 size={20} /></button>}
              {!hideControls && <button onClick={() => onDelete(editedQuestion.id)} title="Xóa" className="p-2.5 text-slate-900 hover:text-rose-900 hover:bg-rose-50 rounded-xl transition shadow-sm bg-slate-100 border border-slate-300 active:scale-90"><Trash2 size={20} /></button>}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          {isEditing ? (
            <div className="relative group/editor">
              <textarea 
                value={editedQuestion.content} 
                onChange={(e) => setEditedQuestion({...editedQuestion, content: e.target.value})}
                onPaste={(e) => handleImagePaste(e, (val) => setEditedQuestion(prev => ({...prev, content: val})), editedQuestion.content)}
                placeholder="Nhập nội dung câu hỏi (Hỗ trợ LaTeX và dán ảnh từ clipboard)..."
                className="w-full text-lg text-slate-950 font-black leading-tight pl-2 bg-white border border-emerald-500 rounded-xl p-4 outline-none focus:ring-4 focus:ring-emerald-50 shadow-inner min-h-[120px]"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-tighter opacity-0 group-hover/editor:opacity-100 transition shadow-sm pointer-events-none">
                <FolderOpen size={10} />
                Có thể dán ảnh (Ctrl+V)
              </div>
            </div>
          ) : (
            <div className="text-lg text-slate-950 font-black leading-tight pl-2">
              <MathRenderer content={editedQuestion.content} />
            </div>
          )}
        </div>

        {editedQuestion.imageUrl && (
          <div className="w-full lg:w-56 shrink-0 animate-in zoom-in fade-in duration-500">
            <div className="relative group/img bg-white p-2 rounded-3xl border-[3px] border-emerald-200 shadow-lg overflow-hidden aspect-square">
              <img src={editedQuestion.imageUrl} alt="Minh họa" className="w-full h-full object-contain rounded-xl" />
              {!isEditing && (
                <button 
                  onClick={() => {
                    const updated = { ...editedQuestion, imageUrl: undefined };
                    setEditedQuestion(updated);
                    onUpdate(updated);
                  }}
                  className="absolute top-1 right-1 p-1.5 bg-rose-600 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition shadow-lg hover:scale-110"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      {editedQuestion.type === QuestionType.MCQ && renderMCQ()}
      {editedQuestion.type === QuestionType.TF && renderTF()}
      {editedQuestion.type === QuestionType.SA && renderSA()}
      {editedQuestion.type === QuestionType.TL && renderTL()}
    </div>
  );
};

const DEFAULT_CONFIG: TestConfig = {
  subject: 'Toán học',
  grade: '12',
  testName: 'Kiểm tra Giữa học kì 1',
  bookSeries: 'Kết nối tri thức với cuộc sống',
  difficulty: 'Vừa phải',
  ratios: { know: 40, understand: 30, apply: 30 },
  topics: [],
  structure: [
    { type: QuestionType.MCQ, label: 'Phần I: MCQ', count: 28, pointPer: 0.25 },
    { type: QuestionType.TF, label: 'Phần II: T/F', count: 4, pointPer: 0.5 },
    { type: QuestionType.SA, label: 'Phần III: SA', count: 2, pointPer: 0.5 },
    { type: QuestionType.TL, label: 'Phần IV: TL', count: 0, pointPer: 0, essayPoints: [] },
  ],
  orientation: 'ICT'
};

const App: React.FC = () => {
  const [showApiModal, setShowApiModal] = useState(false);
  const [showNewWorkConfirm, setShowNewWorkConfirm] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [hasKey, setHasKey] = useState(!!localStorage.getItem('GEMINI_API_KEY'));
  const [step, setStep] = useState(1);
  const [numVersions, setNumVersions] = useState(4);
  const [mixedVersions, setMixedVersions] = useState<GeneratedTest[]>([]);
  const [isMixing, setIsMixing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImported, setIsImported] = useState(false);
  const [isSuggestingTopics, setIsSuggestingTopics] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const key = localStorage.getItem('GEMINI_API_KEY');
    if (!key) {
      setShowApiModal(true);
    }
  }, []);

  const handleResetApp = () => {
    setStep(1);
    setNumVersions(4);
    setMixedVersions([]);
    setIsMixing(false);
    setIsParsing(false);
    setIsImported(false);
    setIsSuggestingTopics(false);
    setGeneratedTest(null);
    setOriginalTest(null);
    setConfig(DEFAULT_CONFIG);
    setShowNewWorkConfirm(false);
  };

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      localStorage.setItem('GEMINI_API_KEY', tempApiKey.trim());
      setHasKey(true);
      setShowApiModal(false);
      setTempApiKey('');
    } else {
      alert("Vui lòng dán API Key vào ô Bước 2.");
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setTempApiKey(text);
    } catch (err) {
      console.error('Không thể dán từ clipboard:', err);
      alert('Vui lòng cho phép quyền truy cập clipboard hoặc dán thủ công.');
    }
  };
  
  const [config, setConfig] = useState<TestConfig>(DEFAULT_CONFIG);

  // Clear topics if subject, grade, book series or orientation changes
  const prevConfigRef = useRef({ 
    subject: config.subject, 
    grade: config.grade, 
    bookSeries: config.bookSeries, 
    orientation: config.orientation 
  });

  React.useEffect(() => {
    const prev = prevConfigRef.current;
    if (
      prev.subject !== config.subject || 
      prev.grade !== config.grade || 
      prev.bookSeries !== config.bookSeries || 
      prev.orientation !== config.orientation
    ) {
      setConfig(c => ({ ...c, topics: [] }));
      prevConfigRef.current = { 
        subject: config.subject, 
        grade: config.grade, 
        bookSeries: config.bookSeries, 
        orientation: config.orientation 
      };
    }
  }, [config.subject, config.grade, config.bookSeries, config.orientation]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTest, setGeneratedTest] = useState<GeneratedTest | null>(null);
  const [originalTest, setOriginalTest] = useState<GeneratedTest | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullScreen(true)).catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullScreen(false));
      }
    }
  };

  React.useEffect(() => {
    const handleFsChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const totalPoints = useMemo(() => {
    return parseFloat(config.structure.reduce((sum, s) => {
      if (s.type === QuestionType.TL && s.essayPoints) {
        return sum + s.essayPoints.reduce((a, b) => a + b, 0);
      }
      return sum + (s.count * s.pointPer);
    }, 0).toFixed(2));
  }, [config.structure]);

  const canGenerate = totalPoints === 10.0 && config.topics.length > 0;

  const handleRatioChange = (key: keyof typeof config.ratios, value: number) => {
    setConfig(prev => ({
      ...prev,
      ratios: { ...prev.ratios, [key]: value }
    }));
  };

  const handleStructureChange = (index: number, field: 'count' | 'pointPer', value: number) => {
    const newStructure = [...config.structure];
    if (field === 'count' && newStructure[index].type === QuestionType.TL) return;
    
    // Enforce non-negative
    let finalValue = Math.max(0, value);
    
    // Enforce integer for count
    if (field === 'count') {
      finalValue = Math.floor(finalValue);
    }

    newStructure[index] = { ...newStructure[index], [field]: finalValue };
    setConfig(prev => ({ ...prev, structure: newStructure }));
  };

  const handleEssayPointChange = (idx: number, pointIdx: number, value: number) => {
    const newStructure = [...config.structure];
    const essayPoints = [...(newStructure[idx].essayPoints || [])];
    
    // Enforce non-negative for points
    essayPoints[pointIdx] = Math.max(0, value);
    
    newStructure[idx] = { ...newStructure[idx], essayPoints, count: essayPoints.length };
    setConfig(prev => ({ ...prev, structure: newStructure }));
  };

  const handleAddEssayQuestion = (idx: number) => {
    const newStructure = [...config.structure];
    const essayPoints = [...(newStructure[idx].essayPoints || []), 1.0];
    newStructure[idx] = { ...newStructure[idx], essayPoints, count: essayPoints.length };
    setConfig(prev => ({ ...prev, structure: newStructure }));
  };

  const handleRemoveEssayQuestion = (idx: number, pointIdx: number) => {
    const newStructure = [...config.structure];
    const essayPoints = (newStructure[idx].essayPoints || []).filter((_, i) => i !== pointIdx);
    newStructure[idx] = { ...newStructure[idx], essayPoints, count: essayPoints.length };
    setConfig(prev => ({ ...prev, structure: newStructure }));
  };

  const handleAddTopic = () => {
    if (newTopic.trim()) {
      setConfig(prev => ({ ...prev, topics: [...prev.topics, newTopic.trim()] }));
      setNewTopic('');
    }
  };

  const handleRemoveTopic = (index: number) => {
    setConfig(prev => ({ ...prev, topics: prev.topics.filter((_, i) => i !== index) }));
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      let text = "";
      let mediaParts: any[] = [];

      if (file.type.startsWith('image/')) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        mediaParts.push({
          inlineData: {
            data: base64,
            mimeType: file.type
          }
        });
      } else if (file.name.endsWith('.pdf')) {
        // For PDF, we'll read as base64 and send to Gemini
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        mediaParts.push({
          inlineData: {
            data: base64,
            mimeType: 'application/pdf'
          }
        });
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        text = await file.text();
      }

      if (!text.trim() && mediaParts.length === 0) {
        alert("File không chứa nội dung hợp lệ.");
        setIsParsing(false);
        return;
      }

      const parsedTest = await parseExistingTest(text, mediaParts);
      
      // Initialize lock flags
      const initializedQuestions = parsedTest.questions.map(q => ({
        ...q,
        lockShuffle: false,
        lockOptions: q.options ? q.options.map(() => false) : (q.subItems ? q.subItems.map(() => false) : [])
      }));

      setGeneratedTest({ ...parsedTest, questions: initializedQuestions });
      setOriginalTest({ ...parsedTest, questions: initializedQuestions });
      setIsImported(true);
      
      // Update config based on parsed metadata and questions
      setConfig(prev => {
        const totalQs = parsedTest.questions.length;
        const nbCount = parsedTest.questions.filter(q => {
          const l = q.level.toLowerCase();
          return l.includes('nhận biết') || l.includes('biết');
        }).length;
        const thCount = parsedTest.questions.filter(q => {
          const l = q.level.toLowerCase();
          return l.includes('thông hiểu') || l.includes('hiểu');
        }).length;
        const vdCount = totalQs - nbCount - thCount;

        const newStructure = prev.structure.map(s => {
          const count = parsedTest.questions.filter(q => q.type === s.type).length;
          return { ...s, count };
        });

        return {
          ...prev,
          subject: parsedTest.metadata?.subject || prev.subject,
          grade: parsedTest.metadata?.grade || prev.grade,
          bookSeries: parsedTest.metadata?.book || prev.bookSeries,
          topics: Array.from(new Set(parsedTest.questions.map(q => q.topic || 'Chủ đề khác'))),
          ratios: {
            know: Math.round((nbCount / totalQs) * 100),
            understand: Math.round((thCount / totalQs) * 100),
            apply: Math.round((vdCount / totalQs) * 100)
          },
          structure: newStructure
        };
      });

      setStep(3); // Go to preview step
      alert("Đã nhập đề thành công! Bạn có thể kiểm tra lại nội dung trước khi trộn.");
    } catch (error) {
      console.error("Lỗi nhập file:", error);
      alert("Đã xảy ra lỗi khi xử lý file. Vui lòng kiểm tra lại định dạng file.");
    } finally {
      setIsParsing(false);
      if (importFileInputRef.current) importFileInputRef.current.value = '';
    }
  };

  const handleUpdateQuestion = (updatedQ: GeneratedQuestion) => {
    if (!originalTest) return;
    const newQuestions = originalTest.questions.map(q => q.id === updatedQ.id ? updatedQ : q);
    const updatedTest = { ...originalTest, questions: newQuestions };
    setOriginalTest(updatedTest);
    // Sync with generatedTest if we are in the preview step to ensure export uses latest data
    if (step === 3) {
      setGeneratedTest(updatedTest);
    }
  };

  const handleDeleteQuestion = (id: number) => {
    if (!originalTest) return;
    if (window.confirm("Bạn có chắc chắn muốn xóa câu hỏi này?")) {
      const newQuestions = originalTest.questions.filter(q => q.id !== id);
      setOriginalTest({ ...originalTest, questions: newQuestions });
    }
  };

  const handleSuggestTopics = async () => {
    setIsSuggestingTopics(true);
    try {
      const suggestions = await getTopicSuggestions(config);
      setConfig(prev => ({ ...prev, topics: suggestions }));
    } catch (error: any) {
      console.error("Lỗi gợi ý:", error);
      if (error?.message?.includes("Requested entity was not found") || error?.message?.includes("API_KEY_INVALID")) {
        alert("API Key không hợp lệ. Vui lòng thiết lập lại.");
        setShowApiModal(true);
      } else {
        alert("Đã có lỗi xảy ra khi lấy gợi ý từ AI.");
      }
    } finally {
      setIsSuggestingTopics(false);
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    try {
      const result = await generateTest(config);
      // Initialize lock flags
      const initializedQuestions = result.questions.map(q => ({
        ...q,
        lockShuffle: false,
        lockOptions: q.options ? new Array(q.options.length).fill(false) : undefined
      }));
      setGeneratedTest({ ...result, questions: initializedQuestions });
      setOriginalTest({ ...result, questions: initializedQuestions });
      setIsImported(false);
      setStep(3);
    } catch (error: any) {
      console.error("Lỗi khi tạo đề:", error);
      if (error?.message?.includes("Requested entity was not found") || error?.message?.includes("API_KEY_INVALID")) {
        alert("API Key không hợp lệ. Vui lòng thiết lập lại.");
        setShowApiModal(true);
      } else {
        alert("Đã có lỗi xảy ra khi gọi AI. Vui lòng kiểm tra kết nối và thử lại.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveWork = async (): Promise<boolean> => {
    const dataToSave = {
      config,
      generatedTest,
      originalTest,
      mixedVersions,
      numVersions,
      isImported,
      step,
      savedAt: new Date().toISOString()
    };
    const jsonString = JSON.stringify(dataToSave, null, 2);
    const suggestedFileName = `SmartTest_Work_${config.subject}_${config.testName}.json`;

    // Try using File System Access API (showSaveFilePicker)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: suggestedFileName,
          types: [{
            description: 'SmartTest Work File',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        alert("Đã lưu công việc thành công tại vị trí bạn chọn!");
        return true;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Lỗi khi lưu file:", err);
          fallbackSave(jsonString, suggestedFileName);
          return true;
        }
        return false;
      }
    } else {
      // Fallback for browsers not supporting the API
      fallbackSave(jsonString, suggestedFileName);
      return true;
    }
  };

  const fallbackSave = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    alert("Hệ thống đã tự động tải xuống file công việc của bạn.");
  };

  const handleOpenWork = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.config) setConfig(data.config);
        if (data.generatedTest !== undefined) setGeneratedTest(data.generatedTest);
        if (data.originalTest !== undefined) setOriginalTest(data.originalTest);
        if (data.mixedVersions !== undefined) setMixedVersions(data.mixedVersions);
        if (data.numVersions !== undefined) setNumVersions(data.numVersions);
        if (data.isImported !== undefined) setIsImported(data.isImported);
        if (data.step) setStep(data.step);
        alert("Đã mở công việc thành công!");
      } catch (err) {
        alert("File công việc không hợp lệ hoặc bị lỗi định dạng.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMixTest = () => {
    if (!originalTest) return;
    setIsMixing(true);
    
    const shuffleArray = <T,>(array: T[]): T[] => {
      const newArr = [...array];
      for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
      }
      return newArr;
    };

    const versions: GeneratedTest[] = [];
    
    const baseTitle = originalTest.title.split(' - Mã đề:')[0];
    
    for (let v = 0; v < numVersions; v++) {
      const gradeMatch = config.grade.match(/\d+/);
      const gradeNum = gradeMatch ? parseInt(gradeMatch[0]) : 1;
      const testCode = (gradeNum * 100 + v + 1).toString();
      let finalQuestions: GeneratedQuestion[] = [];
      
      // Group questions by type to shuffle within each section
      const types = [QuestionType.MCQ, QuestionType.TF, QuestionType.SA, QuestionType.TL];
      
      types.forEach(type => {
        const typeQuestions = originalTest.questions.filter(q => q.type === type);
        if (typeQuestions.length === 0) return;

        const questionsWithOriginalIndex = typeQuestions.map((q, idx) => ({ q, originalIndex: idx }));
        const fixedQuestions = questionsWithOriginalIndex.filter(item => item.q.lockShuffle);
        const shuffleableQuestions = questionsWithOriginalIndex.filter(item => !item.q.lockShuffle);
        
        const shuffledShuffleable = shuffleArray<{ q: GeneratedQuestion, originalIndex: number }>(shuffleableQuestions);
        
        let shuffleIdx = 0;
        const shuffledTypeQuestions: GeneratedQuestion[] = [];
        for (let i = 0; i < typeQuestions.length; i++) {
          const fixed = fixedQuestions.find(item => item.originalIndex === i);
          if (fixed) {
            shuffledTypeQuestions.push(fixed.q);
          } else {
            shuffledTypeQuestions.push(shuffledShuffleable[shuffleIdx++].q);
          }
        }

        // Shuffle options/subItems for each question in this section
        const processedTypeQuestions = shuffledTypeQuestions.map(q => {
          const processedQ = { ...q };
          
          if (processedQ.type === QuestionType.MCQ && processedQ.options) {
            const originalOptions = [...processedQ.options];
            const originalAnswerChar = Array.isArray(processedQ.answer) ? processedQ.answer[0] : processedQ.answer;
            const originalAnswerIndex = originalAnswerChar.charCodeAt(0) - 65;
            const originalAnswerText = originalOptions[originalAnswerIndex];

            const optionItems = originalOptions.map((opt, i) => ({
              text: opt,
              isLocked: processedQ.lockOptions?.[i] || false,
              originalIndex: i
            }));

            const fixedOptions = optionItems.filter(item => item.isLocked);
            const shuffleableOptions = optionItems.filter(item => !item.isLocked);
            const shuffledShuffleableOptions = shuffleArray<{ text: string, isLocked: boolean, originalIndex: number }>(shuffleableOptions);

            const newOptionsTexts: string[] = [];
            let sOptIdx = 0;
            for (let i = 0; i < originalOptions.length; i++) {
              const fOpt = fixedOptions.find(item => item.originalIndex === i);
              if (fOpt) {
                newOptionsTexts.push(fOpt.text);
              } else {
                newOptionsTexts.push(shuffledShuffleableOptions[sOptIdx++].text);
              }
            }

            const newAnswerIndex = newOptionsTexts.indexOf(originalAnswerText);
            const newAnswerChar = String.fromCharCode(65 + newAnswerIndex);
            processedQ.options = newOptionsTexts;
            processedQ.answer = [newAnswerChar];
          }

          if ((processedQ.type === QuestionType.TF || processedQ.type === QuestionType.SA) && processedQ.subItems) {
            const originalSubItems = [...processedQ.subItems];
            const originalAnswers = Array.isArray(processedQ.answer) ? [...processedQ.answer] : [processedQ.answer];
            
            const subItemsWithAnswers = originalSubItems.map((item, i) => ({
              text: item,
              answer: originalAnswers[i] || "",
              isLocked: processedQ.lockOptions?.[i] || false,
              originalIndex: i
            }));

            const fixedSubItems = subItemsWithAnswers.filter(item => item.isLocked);
            const shuffleableSubItems = subItemsWithAnswers.filter(item => !item.isLocked);
            const shuffledShuffleableSubItems = shuffleArray(shuffleableSubItems);

            const newSubItemsTexts: string[] = [];
            const newAnswers: string[] = [];
            
            let sSubIdx = 0;
            for (let i = 0; i < originalSubItems.length; i++) {
              const fSub = fixedSubItems.find(item => item.originalIndex === i);
              if (fSub) {
                newSubItemsTexts.push(fSub.text);
                newAnswers.push(fSub.answer);
              } else {
                const shuffled = shuffledShuffleableSubItems[sSubIdx++];
                newSubItemsTexts.push(shuffled.text);
                newAnswers.push(shuffled.answer);
              }
            }
            processedQ.subItems = newSubItemsTexts;
            processedQ.answer = newAnswers;
          }
          return processedQ;
        });

        finalQuestions = [...finalQuestions, ...processedTypeQuestions];
      });

      // Re-assign IDs sequentially for the whole test
      finalQuestions = finalQuestions.map((q, idx) => ({ ...q, id: idx + 1 }));

      versions.push({
        ...originalTest,
        title: `${baseTitle} - Mã đề: ${testCode}`,
        questions: finalQuestions,
        testCode: testCode
      });
    }

    setMixedVersions(versions);
    setStep(4);
    setIsMixing(false);
  };

  const handleExportAllVersions = () => {
    // Logic to export all versions to a single Word file or multiple
    // For now, let's just alert
    alert("Tính năng xuất hàng loạt mã đề đang được hoàn thiện. Bạn có thể xem từng mã đề bên dưới.");
  };

  const handleReset = () => {
    if (window.confirm("Bạn có chắc chắn muốn hủy bỏ và trộn đề khác?")) {
      setStep(1);
      setGeneratedTest(null);
      setOriginalTest(null);
      setMixedVersions([]);
    }
  };

  const generateTestHtml = (test: GeneratedTest, includeMetadata: boolean = true) => {
    const signatureUrl = "https://drive.google.com/uc?export=view&id=1F3hqkH0k9xBCJosWq5pDD1R0_Zor0yAd";
    const topicsList: string[] = Array.from(new Set(test.questions.map(q => q.topic || 'Chủ đề khác')));
    
    const getPointForQuestion = (q: GeneratedQuestion) => {
      const struct = config.structure.find(s => s.type === q.type);
      if (!struct) return 0;
      if (struct.type === QuestionType.TL && struct.essayPoints) {
        const tlQs = test.questions.filter(qu => qu.type === QuestionType.TL);
        const idx = tlQs.findIndex(qu => qu.id === q.id);
        return struct.essayPoints[idx] || 0;
      }
      return struct.pointPer;
    };

    const getTypeAbbr = (type: QuestionType) => {
      if (type === QuestionType.TF) return 'TF';
      return type;
    };

    const getLevelAbbr = (level: string) => {
      const l = level.toLowerCase();
      if (l.includes('nhận biết') || l.includes('biết')) return 'NB';
      if (l.includes('thông hiểu') || l.includes('hiểu')) return 'TH';
      if (l.includes('vận dụng')) return 'VD';
      return level;
    };

    const htmlHeader = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
      <meta charset='utf-8'>
      <title>${test.title}</title>
      <style>
        @page WordSectionMatrix {
          size: 841.9pt 595.3pt; /* A4 Landscape */
          mso-page-orientation: landscape;
          margin: 56.7pt 42.5pt 56.7pt 56.7pt; /* Top Right Bottom Left */
        }
        @page WordSectionTest {
          size: 595.3pt 841.9pt; /* A4 Portrait */
          mso-page-orientation: portrait;
          margin: 56.7pt 42.5pt 56.7pt 56.7pt; /* Top Right Bottom Left */
        }
        div.SectionMatrix { page: WordSectionMatrix; }
        div.SectionTest { page: WordSectionTest; }

        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.3; text-align: justify; color: black; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 15px; border: 1pt solid black; }
        th, td { border: 1pt solid black; padding: 5pt; text-align: center; vertical-align: middle; word-wrap: break-word; font-size: 12pt; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .text-left { text-align: left; }
        .text-bold { font-weight: bold; }
        .header-box { width: 100%; border: none; margin-bottom: 20px; }
        .header-box td { border: none; text-align: center; font-weight: bold; padding: 0; }
        .title { text-align: center; font-size: 14pt; font-weight: bold; margin-top: 15px; margin-bottom: 5px; text-transform: uppercase; }
        .part-title { font-weight: bold; text-transform: uppercase; margin-top: 12px; margin-bottom: 6px; border-bottom: 1pt solid black; padding-bottom: 2px; }
        .question { margin-top: 8px; margin-bottom: 4px; font-weight: bold; }
        .options { margin-left: 20px; width: 100%; display: table; }
        .option-item { display: table-cell; width: 25%; padding-right: 15pt; }
        .sub-items { margin-left: 20px; font-style: italic; }
        .q-img { max-width: 250px; height: auto; display: block; margin: 10px auto; border: 1pt solid #ccc; padding: 5px; }
      </style>
      </head><body>
    `;

    // Matrix HTML Generation
    let matrixHtml = "";
    if (includeMetadata) {
      matrixHtml = `
        <div class="SectionMatrix">
          <div style="margin-bottom: 20pt;">
            <p style="font-weight: bold; margin: 0;">TRƯỜNG THPT ....................</p>
            <p style="font-weight: bold; margin: 0;">TỔ ....................</p>
            <p style="font-weight: bold; margin: 0;">GV: NGUYỄN TRẦM KHA</p>
            <br/>
            <p style="text-align: center; font-weight: bold; text-transform: uppercase; font-size: 14pt; margin: 0;">
              KÌ ${config.testName.toUpperCase()} – NĂM HỌC: 2025 – 2026
            </p>
            <p style="text-align: center; font-weight: bold; text-transform: uppercase; font-size: 14pt; margin: 0;">
              MÔN: ${config.subject.toUpperCase()} - LỚP: ${config.grade}
            </p>
          </div>
          <div style="text-align: justify; margin-bottom: 20px;">
            <p style="font-weight: bold; text-transform: uppercase; text-align: left; font-size: 14pt; margin-bottom: 10pt;">MỤC TIÊU ĐỀ KIỂM TRA</p>
            <p><b>a). Mục tiêu:</b> đánh giá chính xác kết quả học tập, mức độ đạt chuẩn kiến thức, kỹ năng và phẩm chất của học sinh sau một giai đoạn. Bao gồm:</p>
            <p style="margin-left: 40pt;">- Đánh giá mức độ đạt chuẩn: Xác định khả năng của học sinh so với yêu cầu cần đạt của chương trình giáo dục.</p>
            <p style="margin-left: 40pt;">- Phân loại và xếp loại học sinh: Đánh giá năng lực tư duy, ghi nhớ, hiểu và vận dụng kiến thức vào các tình huống, từ đó phân loại học lực.</p>
            <p style="margin-left: 40pt;">- Cung cấp phản hồi: Giúp giáo viên nhận biết các lỗi sai phổ biến để khắc phục, đồng thời giúp học sinh biết điểm mạnh/yếu của mình.</p>
            <p style="margin-left: 40pt;">- Định hướng dạy và học: Thúc đẩy học sinh ôn tập, củng cố kiến thức và điều chỉnh phương pháp giảng dạy để nâng cao chất lượng.</p>
            <p style="margin-left: 40pt;">- Đảm bảo tính công bằng: Đề kiểm tra xây dựng theo ma trận và đặc tả (nhận biết, thông hiểu, vận dụng) đảm bảo đánh giá toàn diện, khách quan.</p>
            <p><b>b). Nội dung:</b> ${topicsList.join(', ')}.</p>
          </div>
          <table class="header-box">
            <tr>
              <td style="width: 40%">TRƯỜNG THPT ..........<br>TỔ: ...............</td>
              <td style="width: 60%">KHUNG MA TRẬN ĐỀ ${config.testName.toUpperCase()}<br>MÔN: ${test.metadata.subject.toUpperCase()} - LỚP: ${test.metadata.grade}</td>
            </tr>
          </table>
          <div class="title">MA TRẬN ĐỀ KIỂM TRA</div>
          <table>
            <thead>
              <tr>
                <th rowspan="3" style="width: 4%">TT</th>
                <th rowspan="3" style="width: 18%">Nội dung kiến thức / Chủ đề</th>
                <th rowspan="3" style="width: 18%">Đơn vị kiến thức</th>
                <th colspan="6">Mức độ nhận thức</th>
                <th colspan="2" rowspan="2">Tổng</th>
                <th rowspan="3" style="width: 8%">Tỉ lệ (%)</th>
              </tr>
              <tr>
                <th colspan="2">Nhận biết</th>
                <th colspan="2">Thông hiểu</th>
                <th colspan="2">Vận dụng</th>
              </tr>
              <tr>
                <th style="width: 5%">TN</th><th style="width: 5%">TL</th>
                <th style="width: 5%">TN</th><th style="width: 5%">TL</th>
                <th style="width: 5%">TN</th><th style="width: 5%">TL</th>
                <th style="width: 8%">Số câu</th><th style="width: 8%">Điểm</th>
              </tr>
            </thead>
            <tbody>
      `;

      topicsList.forEach((topic, idx) => {
        const topicQs = test.questions.filter(q => q.topic === topic);
        const levels = { nb: { tn: 0, tl: 0, p: 0 }, th: { tn: 0, tl: 0, p: 0 }, vd: { tn: 0, tl: 0, p: 0 } };

        topicQs.forEach(q => {
          const pts = getPointForQuestion(q);
          const isTN = q.type !== QuestionType.TL;
          const lowerLvl = q.level.toLowerCase();
          if (lowerLvl.includes('nhận biết') || lowerLvl.includes('biết')) { if (isTN) levels.nb.tn++; else levels.nb.tl++; levels.nb.p += pts; }
          else if (lowerLvl.includes('thông hiểu') || lowerLvl.includes('hiểu')) { if (isTN) levels.th.tn++; else levels.th.tl++; levels.th.p += pts; }
          else { if (isTN) levels.vd.tn++; else levels.vd.tl++; levels.vd.p += pts; }
        });

        const topicPts = levels.nb.p + levels.th.p + levels.vd.p;
        matrixHtml += `
          <tr>
            <td>${idx + 1}</td>
            <td class="text-left">${topic}</td>
            <td class="text-left">${topic}</td>
            <td>${levels.nb.tn || '-'}</td><td>${levels.nb.tl || '-'}</td>
            <td>${levels.th.tn || '-'}</td><td>${levels.th.tl || '-'}</td>
            <td>${levels.vd.tn || '-'}</td><td>${levels.vd.tl || '-'}</td>
            <td>${topicQs.length}</td>
            <td>${topicPts.toFixed(2)}</td>
            <td>${(topicPts * 10).toFixed(0)}%</td>
          </tr>
        `;
      });

      matrixHtml += `
            <tr class="text-bold">
              <td colspan="3">TỔNG CỘNG</td>
              <td colspan="2">${config.ratios.know / 10}</td>
              <td colspan="2">${config.ratios.understand / 10}</td>
              <td colspan="2">${config.ratios.apply / 10}</td>
              <td>${test.questions.length}</td>
              <td>10.00</td>
              <td>100%</td>
            </tr>
          </tbody>
          </table>
        </div>
      `;
    }

    // Specialization HTML (Spec table)
    let specHtml = "";
    if (includeMetadata) {
      specHtml = `
        <div class="SectionMatrix" style="page-break-before: always;">
          <div class="title">BẢN ĐẶC TẢ MỨC ĐỘ ĐÁNH GIÁ ĐỀ KIỂM TRA</div>
          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 5%">TT</th>
                <th rowspan="2" style="width: 20%">Đơn vị kiến thức</th>
                <th rowspan="2" style="width: 45%">Mức độ đánh giá / Yêu cầu cần đạt</th>
                <th colspan="2" style="width: 15%">Số câu hỏi</th>
                <th rowspan="2" style="width: 15%">Câu hỏi</th>
              </tr>
              <tr>
                <th style="width: 7.5%">TN</th><th style="width: 7.5%">TL</th>
              </tr>
            </thead>
            <tbody>
      `;

      topicsList.forEach((topic, idx) => {
        const topicQs = test.questions.filter(q => q.topic === topic);
        const spec = test.topicSpecifications.find(s => s.topic === topic);
        const levels = ['Nhận biết', 'Thông hiểu', 'Vận dụng'];
        const levelRows: {lvl: string, qList: GeneratedQuestion[]}[] = [];
        
        levels.forEach(lvl => {
          const qList = topicQs.filter(q => q.level.toLowerCase().includes(lvl.toLowerCase()) || (lvl === 'Nhận biết' && q.level.toLowerCase().includes('biết')) || (lvl === 'Thông hiểu' && q.level.toLowerCase().includes('hiểu')));
          if (qList.length > 0) levelRows.push({ lvl, qList });
        });

        levelRows.forEach((row, lIdx) => {
          const tnCount = row.qList.filter(q => q.type !== QuestionType.TL).length;
          const tlCount = row.qList.filter(q => q.type === QuestionType.TL).length;
          specHtml += `
            <tr>
              ${lIdx === 0 ? `<td rowspan="${levelRows.length}">${idx + 1}</td>` : ''}
              ${lIdx === 0 ? `<td rowspan="${levelRows.length}" class="text-left text-bold">${topic}</td>` : ''}
              <td class="text-left"><b>${row.lvl}</b>: ${spec?.requirement || 'Mô tả nội dung theo chương trình.'}</td>
              <td>${tnCount || '-'}</td><td>${tlCount || '-'}</td>
              <td>${row.qList.map(q => q.id).join(', ')}</td>
            </tr>
          `;
        });
      });
      specHtml += `</tbody></table></div>`;
    }

    // Test Content HTML
    const testCodeMatch = test.title.match(/Mã đề:\s*(\d+)/);
    const testCode = testCodeMatch ? testCodeMatch[1] : '';
    const cleanTitle = test.title.replace(/\s*-\s*Mã đề:\s*\d+/, '');

    let testHtml = `
      <div class="SectionTest">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${signatureUrl}" style="max-width: 100px; height: auto;" />
        </div>
        <table class="header-box" style="width: 100%; border: none;">
          <tr>
            <td style="width: 45%; border: none; text-align: left;">TRƯỜNG THPT ..........<br><b>TỔ: ...............</b></td>
            <td style="width: 55%; border: none; text-align: center;"><b>ĐỀ ${config.testName.toUpperCase()}</b><br>NĂM HỌC 2025 - 2026</td>
          </tr>
          ${testCode ? `
          <tr>
            <td style="border: none;"></td>
            <td style="border: none; text-align: center;">
              <table style="width: 120pt; margin: 5pt auto; border: 1.5pt solid black; border-collapse: collapse;">
                <tr><td style="border: none; padding: 5pt; font-weight: bold; font-size: 14pt; text-align: center;">MÃ ĐỀ: ${testCode}</td></tr>
              </table>
            </td>
          </tr>
          ` : ''}
        </table>
        <div class="title">${cleanTitle.toUpperCase()}</div>
        <div style="text-align: center; font-style: italic; margin-bottom: 20px;">
          Môn: ${test.metadata.subject} ${test.metadata.orientation ? `(${test.metadata.orientation})` : ''} - Lớp: ${test.metadata.grade}<br>
          Thời gian làm bài: 45 phút (Không kể thời gian giao đề)
        </div>
    `;

    const processMarkdownForWord = (text: string) => {
      if (!text) return '';
      // Convert markdown images ![alt](data:...) to HTML <img src="data:..." />
      // We use a non-greedy match for the base64 data to handle multiple images
      let processed = text.replace(/!\[.*?\]\((data:image\/.*?;base64,.*?)\)/g, '<img src="$1" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" />');
      // Replace newlines with <br/> for Word
      processed = processed.replace(/\n/g, '<br/>');
      return processed;
    };

    const renderSection = (type: QuestionType, label: string) => {
      const qs = test.questions.filter(q => q.type === type);
      if (qs.length === 0) return '';
      let sect = `<p class="part-title">${label}</p>`;
      qs.forEach((q, index) => {
        const processedContent = processMarkdownForWord(q.content.trim());
        const typeAbbr = getTypeAbbr(q.type);
        const levelAbbr = getLevelAbbr(q.level);
        sect += `<p class="question">Câu ${index + 1} (${typeAbbr}-${levelAbbr}): ${processedContent}</p>`;
        if (q.imageUrl) sect += `<img src="${q.imageUrl}" class="q-img" />`;
        if (type === QuestionType.MCQ && q.options) {
          sect += `<div class="options">`;
          q.options.forEach((opt, oi) => {
            const trimmedOpt = processMarkdownForWord(stripPrefix(opt).trim());
            sect += `<span class="option-item">${String.fromCharCode(65+oi)}. ${trimmedOpt}<span style='mso-tab-count:1'>&nbsp;&nbsp;&nbsp;</span></span>`;
          });
          sect += `</div>`;
        } else if (type === QuestionType.TF && q.subItems) {
          q.subItems.forEach((sub, si) => {
            const trimmedSub = processMarkdownForWord(stripPrefix(sub).trim());
            sect += `<p class="sub-items">${String.fromCharCode(97+si)}. ${trimmedSub}</p>`;
          });
        } else if (type === QuestionType.SA && q.subItems) {
          q.subItems.forEach((sub, si) => {
            const trimmedSub = processMarkdownForWord(stripPrefix(sub).trim());
            sect += `<p class="sub-items">Ý ${String.fromCharCode(97+si)}. ${trimmedSub}</p>`;
          });
        }
      });
      return sect;
    };

    testHtml += renderSection(QuestionType.MCQ, "PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN");
    testHtml += renderSection(QuestionType.TF, "PHẦN II. CÂU HỎI TRẮC NGHIỆM ĐÚNG SAI");
    testHtml += renderSection(QuestionType.SA, "PHẦN III. CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN");
    testHtml += renderSection(QuestionType.TL, "PHẦN IV. CÂU HỎI TỰ LUẬN");

    testHtml += `
      <p class="title" style="font-size: 14pt; page-break-before: always;">ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM</p>
    `;
    
    const renderAnswerSection = (type: QuestionType, label: string) => {
      const qs = test.questions.filter(q => q.type === type);
      if (qs.length === 0) return '';
      let sect = `<p class="part-title">${label}</p>`;
      qs.forEach((q, index) => {
        const pts = getPointForQuestion(q);
        const ansArray = Array.isArray(q.answer) ? q.answer : [q.answer];
        let ansStr = q.type === QuestionType.MCQ ? `<b>${ansArray[0]}</b>` : ansArray.map((a, i) => `${String.fromCharCode(97+i)}: ${a}`).join('; ');
        const processedAnsStr = processMarkdownForWord(ansStr);
        sect += `<p style="margin-top: 0; margin-bottom: 6pt;"><b>Câu ${index + 1}:</b> ${processedAnsStr} (<i>${pts} điểm</i>)</p>`;
      });
      return sect;
    };

    testHtml += renderAnswerSection(QuestionType.MCQ, "PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN");
    testHtml += renderAnswerSection(QuestionType.TF, "PHẦN II. CÂU HỎI TRẮC NGHIỆM ĐÚNG SAI");
    testHtml += renderAnswerSection(QuestionType.SA, "PHẦN III. CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN");
    testHtml += renderAnswerSection(QuestionType.TL, "PHẦN IV. CÂU HỎI TỰ LUẬN");
    
    testHtml += `</div>`;

    return htmlHeader + matrixHtml + specHtml + testHtml + '</body></html>';
  };

  const handleExportWord = (testToExport?: GeneratedTest) => {
    const test = testToExport || generatedTest;
    if (!test) return;
    // Check if it's a mixed version by title pattern or presence in mixedVersions
    const isMixed = test.title.includes("Mã đề:") || mixedVersions.some(v => v.title === test.title);
    const fullHtml = generateTestHtml(test, !isMixed);
    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/vnd.ms-word' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ho_so_de_thi_${test.title.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAllZip = async () => {
    if (mixedVersions.length === 0) return;
    setIsMixing(true); // Reuse loading state
    
    try {
      const zip = new JSZip();
      
      mixedVersions.forEach((version, idx) => {
        const html = generateTestHtml(version, false);
        // Add BOM for Word compatibility
        const content = '\ufeff' + html;
        const gradeMatch = config.grade.match(/\d+/);
        const gradeNum = gradeMatch ? parseInt(gradeMatch[0]) : 1;
        const testCode = (gradeNum * 100 + idx + 1).toString();
        const fileName = `De_thi_ma_${testCode}.doc`;
        zip.file(fileName, content);
      });
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bo_de_thi_tron_${config.testName.replace(/\s+/g, '_')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Lỗi khi tạo file zip:", error);
      alert("Đã xảy ra lỗi khi tạo file nén. Vui lòng thử lại.");
    } finally {
      setIsMixing(false);
    }
  };

  const subjects = [
    'Toán học', 'Khoa học tự nhiên', 'Lịch sử và Địa lí',
    'Vật lí', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lí', 'Giáo dục Kinh tế và Pháp luật',
    'Giáo dục công dân', 'Tin học', 'Công nghệ', 'Giáo dục quốc phòng và an ninh'
  ];

  const isTinHocTHPT = config.subject === 'Tin học' && ['10', '11', '12'].includes(config.grade);
  const isCongNgheTHPT = config.subject === 'Công nghệ' && ['10', '11', '12'].includes(config.grade);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 lg:px-12">
      {/* API Setup Modal */}
      {showApiModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[400px] rounded-3xl shadow-2xl relative overflow-hidden animate-in zoom-in duration-300">
            {/* Close Button */}
            <button 
              onClick={() => hasKey && setShowApiModal(false)}
              className={`absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition ${!hasKey ? 'hidden' : ''}`}
            >
              <X size={20} />
            </button>

            <div className="p-7 space-y-6">
              <h2 className="text-xl font-black text-[#2563eb] text-center uppercase tracking-tight">Cài đặt API</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bước 1:</label>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-4 bg-[#eff6ff] border-2 border-[#dbeafe] rounded-xl text-[#2563eb] font-black text-base hover:bg-[#dbeafe] transition shadow-sm"
                  >
                    <span className="text-xl">🔑</span> LẤY API KEY
                  </a>
                </div>

                <div className="bg-[#f8fafc] p-4 rounded-xl border-2 border-[#f1f5f9] space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hướng dẫn:</h4>
                  <ol className="text-xs font-bold text-slate-500 space-y-1 list-decimal ml-4">
                    <li>Nhấn nút 'LẤY API KEY' phía trên</li>
                    <li>Nhấn 'Create API key' (màu xanh)</li>
                    <li>Copy mã đó và Dán vào ô Bước 2 bên dưới</li>
                  </ol>
                </div>

                <div className="text-center">
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-slate-400 italic hover:underline"
                  >
                    Lấy key miễn phí tại Google AI Studio
                  </a>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bước 2:</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={handlePaste}
                      className="px-4 bg-[#f1f5f9] border-2 border-transparent rounded-xl font-black text-[#2563eb] hover:bg-[#dbeafe] transition shadow-inner uppercase text-xs"
                    >
                      Dán
                    </button>
                    <input 
                      type="password"
                      placeholder="DÁN API KEY VÀO ĐÂY"
                      value={tempApiKey}
                      onChange={(e) => setTempApiKey(e.target.value)}
                      className="flex-1 p-4 bg-[#f1f5f9] border-2 border-transparent rounded-xl text-center font-black text-slate-400 outline-none focus:border-[#2563eb] focus:bg-white transition shadow-inner placeholder:text-slate-300 text-sm"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleSaveApiKey}
                  className="w-full py-4 bg-[#2563eb] text-white rounded-xl font-black text-base hover:bg-[#1d4ed8] transition shadow-xl shadow-blue-200 active:scale-95 uppercase tracking-wide"
                >
                  Lưu & Bắt đầu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showNewWorkConfirm && (
        <div className="fixed inset-0 bg-slate-900/80 z-[400] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[450px] rounded-3xl shadow-2xl relative overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4 text-rose-600">
                <AlertCircle size={40} />
                <h2 className="text-xl font-black uppercase tracking-tight">Xác nhận công việc mới</h2>
              </div>
              
              <p className="text-sm font-bold text-slate-600 leading-relaxed">
                Mọi công việc đang có sẽ không còn! Thầy cô có muốn <span className="text-emerald-700">Lưu lại</span> công việc của mình trước khi <span className="text-rose-600">Mở công việc mới</span> không?
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                  onClick={async () => {
                    const success = await handleSaveWork();
                    if (success) {
                      handleResetApp();
                    }
                  }}
                  className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-black text-base hover:bg-emerald-700 transition shadow-lg active:scale-95"
                >
                  <Save size={20} /> CÓ (LƯU)
                </button>
                <button 
                  onClick={handleResetApp}
                  className="flex items-center justify-center gap-2 py-4 bg-slate-200 text-slate-700 rounded-2xl font-black text-base hover:bg-slate-300 transition active:scale-95"
                >
                  <X size={20} /> KHÔNG
                </button>
              </div>
              
              <button 
                onClick={() => setShowNewWorkConfirm(false)}
                className="w-full py-3 text-slate-400 font-bold text-xs hover:text-slate-600 transition uppercase tracking-widest"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
      {isParsing && (
        <div className="fixed inset-0 bg-[#333640] z-[200] flex items-center justify-center p-8">
          <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-7 border-[4px] border-blue-600">
            <div className="relative inline-block scale-110">
              <FileText className="text-blue-800 w-16 h-16 animate-pulse" />
              <div className="absolute inset-0 border-[6px] border-blue-800 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-2xl font-black text-slate-950 uppercase tracking-tighter">AI đang đọc đề của bạn</h3>
            <p className="text-slate-900 text-base font-black leading-relaxed">
              Vui lòng đợi trong giây lát để AI trích xuất câu hỏi và đáp án từ file của bạn.
            </p>
          </div>
        </div>
      )}
      {isGenerating && (
        <div className="fixed inset-0 bg-[#333640] z-[200] flex items-center justify-center p-8">
          <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-7 border-[4px] border-emerald-600">
            <div className="relative inline-block scale-110">
              <Sparkles className="text-emerald-800 w-16 h-16 animate-pulse" />
              <div className="absolute inset-0 border-[6px] border-emerald-800 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-2xl font-black text-slate-950 uppercase tracking-tighter">Hệ thống đang soạn đề</h3>
            <p className="text-slate-900 text-base font-black leading-relaxed">
              Vui lòng đợi trong giây lát để AI hoàn thiện hồ sơ đề thi chuyên nghiệp chuẩn GDPT 2018 và CV 7991.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 print:hidden">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-800 rounded-2xl text-white shadow-xl shadow-emerald-300 ring-4 ring-emerald-50">
               <Sparkles size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-950 tracking-tighter flex items-center gap-2 cursor-pointer" onClick={() => setStep(1)}>
                {"SmartTest AI".split("").map((char, i) => (
                  <span 
                    key={i} 
                    className="animate-char" 
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                ))}
                <span className="text-emerald-700 text-sm font-black px-2 py-0.5 bg-emerald-50 rounded-lg border border-emerald-200">PRO</span>
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="bg-slate-950 text-white uppercase text-[11px] font-black tracking-widest px-5 py-2.5 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/5 relative overflow-hidden">
                  <span className="relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                    ỨNG DỤNG SOẠN VÀ TRỘN ĐỀ AI - NGUYỄN TRẦM KHA - 0917.548.463
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-950 ml-2 uppercase tracking-widest">TÁC VỤ:</span>
              <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border-2 border-slate-200 shadow-sm">
                  <button 
                    onClick={() => setShowNewWorkConfirm(true)} 
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-black text-xs hover:bg-rose-700 transition shadow-lg active:scale-95"
                    title="Mở công việc mới và đóng công việc hiện tại"
                  >
                    <RefreshCw size={16} /> Mới và Đóng
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleOpenWork} 
                    className="hidden" 
                    accept=".json" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-950 rounded-xl font-black text-xs hover:bg-slate-200 transition active:scale-95"
                    title="Mở file công việc đã lưu (.json)"
                  >
                    <FolderOpen size={16} className="text-emerald-800" /> Mở
                  </button>
                 <button 
                   onClick={handleSaveWork} 
                   className="flex items-center gap-2 px-4 py-2 bg-emerald-800 text-white rounded-xl font-black text-xs hover:bg-emerald-900 transition shadow-lg active:scale-95"
                   title="Lưu tiến trình hiện tại và chọn đường dẫn lưu file"
                 >
                   <Save size={16} /> Lưu
                 </button>
                 <button 
                   onClick={() => setShowApiModal(true)}
                   className="flex items-center gap-2 px-4 py-2 bg-emerald-800 text-white rounded-xl font-black text-xs hover:bg-emerald-900 transition shadow-lg active:scale-95"
                   title="Cấu hình API Key Gemini"
                 >
                   <Settings size={16} /> {hasKey ? "Đã cài API" : "Cài API"}
                 </button>
                 <button 
                   onClick={toggleFullScreen}
                   className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-slate-900 rounded-xl font-black text-xs hover:bg-yellow-500 transition shadow-lg active:scale-95 border border-yellow-600"
                   title="Chế độ toàn màn hình"
                 >
                   {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />} Full
                 </button>
              </div>
            </div>

            <div className="flex items-center justify-between w-full gap-6">
              <div className="flex items-center gap-3">
                <input 
                  type="file" 
                  ref={importFileInputRef} 
                  onChange={handleImportFile} 
                  className="hidden" 
                  accept=".docx,.txt,.pdf,.png,.jpg,.jpeg" 
                />
                <button 
                  onClick={() => importFileInputRef.current?.click()} 
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition shadow-lg active:scale-95 border border-blue-800"
                  title="Nhập đề từ file PDF, Word hoặc Ảnh để trộn"
                >
                  <FileDown size={16} /> Nhập đề PDF
                </button>

                <nav className="flex items-center gap-3">
                  {[
                    { s: 1, l: 'Cấu hình' },
                    { s: 2, l: 'Ma trận' },
                    { s: 3, l: 'Xem đề gốc' },
                    { s: 4, l: 'Trộn đề' }
                  ].map((item, i) => {
                    const isClickable = item.s === 1 || 
                                       (item.s === 2 && config.topics.length > 0) || 
                                       (item.s === 3 && originalTest) || 
                                       (item.s === 4 && mixedVersions.length > 0);
                    const isActive = step === item.s;

                    let buttonClass = `flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-sm transition-all border-2 shadow-sm `;
                    buttonClass += isActive 
                      ? 'bg-emerald-800 text-white border-emerald-950 shadow-xl' 
                      : isClickable 
                        ? 'bg-white text-slate-800 border-slate-300 hover:border-emerald-500 cursor-pointer' 
                        : 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed';

                    let spanClass = `w-6 h-6 rounded-lg flex items-center justify-center text-xs `;
                    spanClass += isActive ? 'bg-white text-emerald-800 font-black' : 'bg-slate-300 text-slate-800 font-bold';

                    return (
                      <React.Fragment key={item.s}>
                        <button 
                          disabled={!isClickable}
                          onClick={() => setStep(item.s)}
                          className={buttonClass}
                        >
                          <span className={spanClass}>{item.s}</span>
                          {item.l}
                        </button>
                        {i < 3 && <div className="w-4 h-1 bg-slate-400 rounded-full" />}
                      </React.Fragment>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-[600px]">
          {step === 1 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-left-10 duration-600">
              <section className="bg-white rounded-3xl shadow-xl border-2 border-slate-300 p-8 space-y-7">
                <h2 className="text-xl font-black text-slate-950 flex items-center gap-3 uppercase tracking-tighter">
                  <Settings className="text-emerald-800" size={24} /> CẤU HÌNH CƠ BẢN
                </h2>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Môn học học thuật</label>
                    <select value={config.subject} onChange={(e) => setConfig({...config, subject: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-slate-950 font-black outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-700 appearance-none shadow-sm cursor-pointer text-base">
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Khối lớp giảng dạy</label>
                    <select value={config.grade} onChange={(e) => setConfig({...config, grade: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-slate-950 font-black outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-700 appearance-none shadow-sm cursor-pointer text-base">
                      {[6, 7, 8, 9, 10, 11, 12].map(l => <option key={l} value={l.toString()}>Khối {l}</option>)}
                    </select>
                  </div>
                </div>

                {isTinHocTHPT && (
                   <div className="animate-in fade-in slide-in-from-top-6 duration-500 space-y-2">
                    <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Phân hệ định hướng (Tin học 10-12)</label>
                    <div className="flex gap-3">
                      {(['ICT', 'CS'] as const).map(o => (
                        <button key={o} onClick={() => setConfig({...config, orientation: o})} className={`flex-1 py-4 rounded-2xl text-sm font-black transition-all border-2 ${config.orientation === o ? 'bg-blue-800 text-white border-blue-950 shadow-xl' : 'bg-white border-slate-300 text-slate-700 hover:border-blue-600 hover:bg-blue-50 shadow-sm'}`}>
                          {o === 'ICT' ? 'Công nghệ ICT' : 'Khoa học máy tính (CS)'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isCongNgheTHPT && (
                   <div className="animate-in fade-in slide-in-from-top-6 duration-500 space-y-2">
                    <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Phân hệ định hướng (Công nghệ 10-12)</label>
                    <div className="flex gap-3">
                      {(['Công nghiệp', 'Nông nghiệp'] as const).map(o => (
                        <button key={o} onClick={() => setConfig({...config, orientation: o})} className={`flex-1 py-4 rounded-2xl text-sm font-black transition-all border-2 ${config.orientation === o ? 'bg-emerald-800 text-white border-emerald-950 shadow-xl' : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-600 hover:bg-emerald-50 shadow-sm'}`}>
                          {o === 'Công nghiệp' ? 'Công nghệ Công nghiệp' : 'Công nghệ Nông nghiệp'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Tên kỳ kiểm tra đánh giá</label>
                  <select value={config.testName} onChange={(e) => setConfig({...config, testName: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-slate-950 font-black outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-700 appearance-none shadow-sm cursor-pointer text-base">
                    <option>Kiểm tra Giữa học kì 1</option>
                    <option>Kiểm tra Cuối học kì 1</option>
                    <option>Kiểm tra Giữa học kì 2</option>
                    <option>Kiểm tra Cuối học kì 2</option>
                    <option>Kiểm tra Thường xuyên / 15 phút</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Nguồn học liệu / Bộ sách</label>
                  <select value={config.bookSeries} onChange={(e) => setConfig({...config, bookSeries: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-slate-950 font-black outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-700 appearance-none shadow-sm cursor-pointer text-base">
                    <option>Kết nối tri thức với cuộc sống</option>
                    <option>Chân trời sáng tạo</option>
                    <option>Cánh diều</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Phân loại mức độ năng lực</label>
                  <div className="flex gap-3">
                    {(['Dễ', 'Vừa phải', 'Khó'] as Difficulty[]).map(d => (
                      <button key={d} onClick={() => setConfig({...config, difficulty: d})} className={`flex-1 py-4 rounded-2xl text-xs font-black transition-all border-2 ${config.difficulty === d ? 'bg-emerald-800 text-white border-emerald-950 shadow-xl scale-105' : 'bg-white border-slate-300 text-slate-800 hover:border-emerald-600 hover:bg-emerald-50 shadow-sm'}`}>{d.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-3xl shadow-xl border-2 border-slate-300 p-8 flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950 mb-8 flex items-center gap-3 uppercase tracking-tighter">
                    <BarChart3 className="text-emerald-800" size={24} /> TỈ LỆ MA TRẬN NĂNG LỰC (%)
                  </h2>
                  <div className="space-y-8 px-4">
                    {[
                      { label: 'NHẬN BIẾT (Knowledge)', key: 'know' as const, val: config.ratios.know, color: 'accent-blue-800' },
                      { label: 'THÔNG HIỂU (Comprehension)', key: 'understand' as const, val: config.ratios.understand, color: 'accent-emerald-800' },
                      { label: 'VẬN DỤNG (Application)', key: 'apply' as const, val: config.ratios.apply, color: 'accent-amber-800' }
                    ].map(item => (
                      <div key={item.key}>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-base font-black text-slate-900">{item.label}</span>
                          <span className="text-2xl font-black text-slate-950">{item.val}%</span>
                        </div>
                        <input type="range" min="0" max="100" step="5" value={item.val} onChange={(e) => handleRatioChange(item.key, parseInt(e.target.value))} className={`w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer border-2 border-white shadow-md ${item.color}`} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t-2 border-slate-100 flex items-center justify-between">
                   <div className={`px-5 py-3 rounded-2xl text-base font-black border-2 transition-all shadow-lg ${config.ratios.know + config.ratios.understand + config.ratios.apply === 100 ? 'bg-emerald-100 text-emerald-900 border-emerald-400' : 'bg-rose-100 text-rose-900 border-rose-400 animate-pulse'}`}>
                    Tổng: {config.ratios.know + config.ratios.understand + config.ratios.apply}%
                   </div>
                   <button onClick={() => { setStep(2); if (config.topics.length === 0) handleSuggestTopics(); }} className="flex items-center gap-3 px-8 py-4 bg-slate-950 text-white rounded-2xl font-black text-lg hover:bg-slate-900 transition shadow-xl active:scale-95 ring-2 ring-slate-100">
                    Tiếp tục <ChevronRight size={20} />
                  </button>
                </div>
              </section>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-10 duration-600">
              <section className="bg-white rounded-3xl shadow-xl border-2 border-slate-300 p-8 space-y-7">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black text-slate-950 flex items-center gap-3 uppercase tracking-tighter">
                    <Layout className="text-emerald-800" size={24} /> CẤU TRÚC ĐỀ THI
                  </h2>
                  <div className={`px-5 py-3 rounded-2xl text-base font-black transition-all border-2 ${totalPoints === 10 ? 'bg-slate-950 text-emerald-400 border-slate-950 shadow-xl' : 'bg-rose-100 text-rose-900 border-rose-400'}`}>
                    TỔNG ĐIỂM: {totalPoints.toFixed(1)} / 10.0
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b-4 border-slate-100">
                        <th className="text-[10px] font-black text-slate-800 uppercase pb-4 px-3 tracking-widest">Phần / Loại câu</th>
                        <th className="text-[10px] font-black text-slate-800 uppercase pb-4 text-center tracking-widest">Số câu</th>
                        <th className="text-[10px] font-black text-slate-800 uppercase pb-4 text-center tracking-widest">Điểm/Câu</th>
                        <th className="text-[10px] font-black text-slate-800 uppercase pb-4 text-right px-3 tracking-widest">Điểm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-50">
                      {config.structure.map((item, idx) => {
                        if (item.type === QuestionType.TL) {
                          return (
                            <React.Fragment key={item.type}>
                              <tr className="border-t-2 border-slate-100">
                                <td className="py-5 px-3 font-black text-slate-950 text-base leading-tight" colSpan={3}>
                                  <div className="flex items-center justify-between">
                                    <span>{item.label}</span>
                                    <button 
                                      onClick={() => handleAddEssayQuestion(idx)}
                                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase hover:bg-emerald-800 transition shadow-md"
                                    >
                                      <Plus size={14} /> Thêm câu TL
                                    </button>
                                  </div>
                                </td>
                                <td className="py-5 px-3 text-right font-black text-slate-900 text-xl">
                                  {(item.essayPoints || []).reduce((a, b) => a + b, 0).toFixed(2)}
                                </td>
                              </tr>
                              {(item.essayPoints || []).map((pt, pIdx) => (
                                <tr key={`${item.type}-${pIdx}`} className="bg-slate-50/50">
                                  <td className="py-3 px-8 text-xs font-bold text-slate-600">
                                    Câu tự luận {pIdx + 1}
                                  </td>
                                  <td className="py-3 text-center" colSpan={2}>
                                    <div className="flex items-center justify-center gap-3">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Điểm:</span>
                                      <input 
                                        type="number" 
                                        step="0.25" 
                                        min="0"
                                        value={pt === 0 ? '' : pt} 
                                        onChange={(e) => handleEssayPointChange(idx, pIdx, parseFloat(e.target.value) || 0)} 
                                        className="w-20 text-center px-2 py-1.5 bg-white border-2 border-slate-200 rounded-lg focus:border-emerald-600 outline-none text-sm font-black shadow-sm" 
                                      />
                                      <button 
                                        onClick={() => handleRemoveEssayQuestion(idx, pIdx)}
                                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-right font-bold text-slate-600 text-sm">
                                    {pt.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        }
                        return (
                          <tr key={item.type}>
                            <td className="py-5 px-3 font-black text-slate-950 text-base leading-tight">{item.label}</td>
                            <td className="py-5 text-center">
                              <input 
                                type="number" 
                                min="0"
                                value={item.count === 0 ? '' : item.count} 
                                onChange={(e) => handleStructureChange(idx, 'count', parseInt(e.target.value) || 0)} 
                                className="w-24 mx-auto block text-center px-2 py-3 bg-slate-50 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-700 outline-none text-lg font-black shadow-inner" 
                              />
                            </td>
                            <td className="py-5 text-center">
                              <input 
                                type="number" 
                                step="0.05" 
                                min="0"
                                value={item.pointPer === 0 ? '' : item.pointPer} 
                                onChange={(e) => handleStructureChange(idx, 'pointPer', parseFloat(e.target.value) || 0)} 
                                className="w-28 mx-auto block text-center px-2 py-3 bg-slate-50 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-700 outline-none text-lg font-black shadow-inner" 
                              />
                            </td>
                            <td className="py-5 px-3 text-right font-black text-slate-900 text-xl">{(item.count * item.pointPer).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-start gap-4 p-6 bg-slate-100 rounded-2xl border-2 border-slate-300 shadow-sm">
                  <Info className="text-emerald-800 shrink-0 mt-1" size={20} />
                  <p className="text-slate-950 text-xs font-black leading-relaxed italic">
                    Quy tắc của ứng dụng: Câu hỏi dạng Đúng/Sai (TF) và Trả lời ngắn (SA) được AI soạn thảo mặc định 4 ý thành phần (a, b, c, d). Điểm số mỗi câu sẽ được phân bổ đều cho từng ý trả lời đúng.
                  </p>
                </div>
              </section>

              <section className="bg-white rounded-3xl shadow-xl border-2 border-slate-300 p-8 space-y-7 flex flex-col">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-950 flex items-center gap-3 uppercase tracking-tighter">
                    <BookOpen className="text-emerald-800" size={24} /> CHỦ ĐỀ CỐT LÕI
                  </h2>
                  <button 
                    onClick={handleSuggestTopics} 
                    disabled={isSuggestingTopics} 
                    className="text-[11px] font-black text-white bg-linear-to-r from-emerald-600 to-teal-600 flex items-center gap-2 hover:from-emerald-700 hover:to-teal-700 px-5 py-2.5 rounded-xl border-2 border-emerald-900/20 transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] active:scale-95 disabled:opacity-50 group"
                  >
                    <RefreshCw size={16} className={`${isSuggestingTopics ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} /> 
                    Tải lại gợi ý AI
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 max-h-[350px] pr-3 custom-scrollbar">
                  {config.topics.map((topic, index) => (
                    <div key={index} className="group flex items-center justify-between py-2 px-4 bg-slate-50 border-2 border-slate-300 rounded-xl hover:border-emerald-600 transition shadow-sm">
                      <span className="text-sm font-black text-slate-950 leading-tight">{topic}</span>
                      <button onClick={() => handleRemoveTopic(index)} className="text-rose-600 hover:text-rose-800 transition-all hover:scale-110 active:scale-90 p-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200" title="Xóa chủ đề">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input type="text" placeholder="Thêm chủ đề bài học mới..." value={newTopic} onChange={(e) => setNewTopic(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddTopic()} className="flex-1 py-2 px-4 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm font-black outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-700 shadow-inner" />
                  <button onClick={handleAddTopic} className="px-4 py-2 bg-emerald-800 text-white rounded-xl hover:bg-emerald-900 transition shadow-xl active:scale-90 border-2 border-emerald-950"><Plus size={20} /></button>
                </div>

                <div className="pt-8 border-t-2 border-slate-100 flex gap-4 mt-auto">
                  <button onClick={() => setStep(1)} className="flex items-center gap-3 px-8 py-4 bg-slate-100 text-slate-950 border-2 border-slate-300 rounded-2xl font-black text-lg hover:bg-slate-200 transition active:scale-90 shadow-sm"><ArrowLeft size={20} /> Quay lại</button>
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !canGenerate}
                    className={`flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-xl text-white transition-all shadow-xl active:scale-95 ${canGenerate ? 'bg-emerald-800 hover:bg-emerald-900 border-[4px] border-emerald-950 shadow-emerald-200/50' : 'bg-slate-400 cursor-not-allowed border-[4px] border-slate-400 opacity-60'}`}
                  >
                    {isGenerating ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
                    {isGenerating ? "AI đang soạn..." : "Kích hoạt soạn đề AI"}
                  </button>
                </div>
              </section>
            </div>
          )}

          {step === 3 && originalTest && (
            <div className="bg-white rounded-3xl shadow-2xl border-[4px] border-emerald-400 p-10 animate-in fade-in zoom-in duration-800 print:shadow-none print:border-none">
              <header className="mb-10 pb-8 border-b-4 border-slate-100">
                <h2 className="text-4xl font-black text-slate-950 mb-4 uppercase tracking-tighter leading-[1.1]">{originalTest.title}</h2>
                <div className="flex flex-wrap gap-6 text-sm font-black text-slate-800 uppercase tracking-widest">
                  <span className="flex items-center gap-3 text-emerald-900 bg-emerald-100 px-5 py-2 rounded-2xl border-2 border-emerald-400 shadow-sm ring-2 ring-emerald-50"><FileText size={20} /> {originalTest.metadata.subject}{originalTest.metadata.orientation ? ` (${originalTest.metadata.orientation})` : ''}</span>
                  <span className="flex items-center gap-2"><ChevronRight size={20} className="text-slate-400" /> Khối {originalTest.metadata.grade}</span>
                  <span className="flex items-center gap-2"><ChevronRight size={20} className="text-slate-400" /> Sách: {originalTest.metadata.book}</span>
                </div>
              </header>
              
              <div className="space-y-12">
                {[
                  { type: QuestionType.MCQ, label: "PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN" },
                  { type: QuestionType.TF, label: "PHẦN II. CÂU HỎI TRẮC NGHIỆM ĐÚNG SAI" },
                  { type: QuestionType.SA, label: "PHẦN III. CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN" },
                  { type: QuestionType.TL, label: "PHẦN IV. CÂU HỎI TỰ LUẬN" }
                ].map((section) => {
                  const qs = originalTest.questions.filter(q => q.type === section.type);
                  if (qs.length === 0) return null;
                  return (
                    <div key={section.type} className="space-y-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="h-10 w-2 bg-emerald-600 rounded-full"></div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{section.label}</h3>
                      </div>
                      <div className="space-y-8">
                        {qs.map((q, index) => (
                          <QuestionRenderer 
                            key={q.id} 
                            displayId={index + 1}
                            question={q} 
                            subject={config.subject}
                            onUpdate={handleUpdateQuestion}
                            onDelete={handleDeleteQuestion}
                            onRequestApiSetup={() => setShowApiModal(true)}
                            hideControls={false}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <footer className="mt-16 pt-10 border-t-4 border-slate-100 space-y-8 print:hidden">
                <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                  <button onClick={() => setStep(2)} className="px-10 py-5 bg-slate-100 border-2 border-slate-300 rounded-2xl font-black text-xl hover:bg-slate-200 transition shadow-md active:scale-95">Quay lại</button>
                  
                  <button 
                    onClick={() => {
                      setGeneratedTest(null);
                      setOriginalTest(null);
                      setStep(1);
                    }} 
                    className="px-10 py-5 bg-white border-2 border-emerald-600 text-emerald-900 rounded-2xl font-black text-xl hover:bg-emerald-50 transition shadow-lg flex items-center gap-2 active:scale-95"
                  >
                    <Plus size={24} /> Tạo đề khác
                  </button>

                  <button onClick={handleMixTest} className="px-10 py-5 bg-emerald-800 text-white rounded-2xl font-black text-xl hover:bg-emerald-900 transition shadow-xl flex items-center gap-2 active:scale-95 border-2 border-emerald-950">
                    <RefreshCw size={24} className={isMixing ? "animate-spin" : ""} /> Trộn đề ngay
                  </button>

                  {!isImported && (
                    <div className="flex flex-col items-center gap-3">
                      <button onClick={() => handleExportWord(originalTest)} className="px-14 py-5 bg-slate-950 text-white rounded-2xl font-black text-2xl hover:bg-slate-900 transition shadow-2xl active:scale-95">Xuất file Word</button>
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-[10px] text-blue-800 font-bold">
                        <Info size={14} />
                        <span>Mẹo: Sử dụng MathType trong Word, nhấn <b>Alt + \</b> để chuyển LaTeX sang công thức.</span>
                      </div>
                    </div>
                  )}
                </div>
              </footer>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-600">
              {/* Mix Configuration Bar (Image 5 style) */}
              <div className="bg-[#064e3b] p-8 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border-4 border-emerald-900/50">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2 ml-2">Cấu hình xuất mã đề</span>
                  <div className="flex items-center gap-4 bg-emerald-950/30 p-3 rounded-3xl border border-emerald-800/50">
                    <span className="text-sm font-black text-white uppercase ml-2">Số lượng:</span>
                    <div className="flex items-center bg-emerald-900/80 rounded-2xl overflow-hidden border-2 border-emerald-700 shadow-inner">
                      <button 
                        onClick={() => setNumVersions(Math.max(1, numVersions - 1))}
                        className="p-4 text-white hover:bg-emerald-800 transition active:bg-emerald-700"
                      >
                        <Minus size={20} />
                      </button>
                      <div className="w-16 text-center text-2xl font-black text-white">{numVersions}</div>
                      <button 
                        onClick={() => setNumVersions(Math.min(24, numVersions + 1))}
                        className="p-4 text-white hover:bg-emerald-800 transition active:bg-emerald-700"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleMixTest}
                  disabled={isMixing}
                  className="w-full md:w-auto px-12 py-6 bg-[#10b981] text-white rounded-[35px] font-black text-2xl hover:bg-[#059669] transition-all shadow-[0_15px_40px_rgba(16,185,129,0.4)] active:scale-95 flex items-center justify-center gap-4 border-b-8 border-emerald-800"
                >
                  {isMixing ? <Loader2 size={28} className="animate-spin" /> : "HOÁN VỊ & TẠO MÃ ĐỀ NGAY 🔥"}
                </button>
              </div>

              {/* Versions List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {mixedVersions.map((version, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-[32px] border-2 border-slate-200 shadow-lg hover:border-emerald-500 hover:shadow-2xl transition-all group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-14 h-14 bg-slate-950 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-xl ring-4 ring-slate-100">
                        {version.testCode || (101 + idx)}
                      </div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mã đề thi</span>
                    </div>
                    <h4 className="font-black text-slate-900 mb-8 line-clamp-2 h-14 text-lg leading-tight">{version.title}</h4>
                    <button 
                      onClick={() => {
                        setGeneratedTest(version);
                        setStep(6);
                      }}
                      className="w-full py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-sm hover:bg-emerald-800 hover:text-white transition-all border-2 border-slate-200 flex items-center justify-center gap-3 shadow-sm active:scale-95"
                    >
                      <FileText size={20} /> Xem chi tiết
                    </button>
                  </div>
                ))}
              </div>

              {mixedVersions.length > 0 && (
                <div className="flex flex-col items-center gap-4 pt-8">
                  <button 
                    onClick={handleExportAllZip}
                    disabled={isMixing}
                    className="flex items-center gap-4 px-12 py-6 bg-slate-950 text-white rounded-[30px] font-black text-xl hover:bg-slate-900 transition-all shadow-2xl active:scale-95 border-b-4 border-slate-800"
                  >
                    {isMixing ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}
                    TẢI TOÀN BỘ ZIP (TẤT CẢ MÃ ĐỀ)
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 6 && generatedTest && (
            <div className="bg-white rounded-3xl shadow-2xl border-[4px] border-blue-400 p-10 animate-in fade-in zoom-in duration-800 print:shadow-none print:border-none">
              <header className="mb-10 pb-8 border-b-4 border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-4xl font-black text-slate-950 uppercase tracking-tighter leading-[1.1]">{generatedTest.title}</h2>
                  <div className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-lg border-2 border-blue-800">
                    MÃ ĐỀ: {generatedTest.testCode}
                  </div>
                </div>
                <div className="flex flex-wrap gap-6 text-sm font-black text-slate-800 uppercase tracking-widest">
                  <span className="flex items-center gap-3 text-blue-900 bg-blue-50 px-5 py-2 rounded-2xl border-2 border-blue-400 shadow-sm ring-2 ring-blue-50"><FileText size={20} /> {generatedTest.metadata.subject}{generatedTest.metadata.orientation ? ` (${generatedTest.metadata.orientation})` : ''}</span>
                  <span className="flex items-center gap-2"><ChevronRight size={20} className="text-slate-400" /> Khối {generatedTest.metadata.grade}</span>
                  <span className="flex items-center gap-2"><ChevronRight size={20} className="text-slate-400" /> Sách: {generatedTest.metadata.book}</span>
                </div>
              </header>
              
              <div className="space-y-12">
                {[
                  { type: QuestionType.MCQ, label: "PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN" },
                  { type: QuestionType.TF, label: "PHẦN II. CÂU HỎI TRẮC NGHIỆM ĐÚNG SAI" },
                  { type: QuestionType.SA, label: "PHẦN III. CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN" },
                  { type: QuestionType.TL, label: "PHẦN IV. CÂU HỎI TỰ LUẬN" }
                ].map((section) => {
                  const qs = generatedTest.questions.filter(q => q.type === section.type);
                  if (qs.length === 0) return null;
                  return (
                    <div key={section.type} className="space-y-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="h-10 w-2 bg-blue-600 rounded-full"></div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{section.label}</h3>
                      </div>
                      <div className="space-y-8">
                        {qs.map((q, index) => (
                          <QuestionRenderer 
                            key={q.id} 
                            displayId={index + 1}
                            question={q} 
                            subject={config.subject}
                            onUpdate={() => {}} // Read-only for mixed versions
                            onDelete={() => {}} // Read-only for mixed versions
                            onRequestApiSetup={() => setShowApiModal(true)}
                            hideControls={true}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <footer className="mt-16 pt-10 border-t-4 border-slate-100 space-y-8 print:hidden">
                <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                  <button onClick={() => setStep(4)} className="px-10 py-5 bg-slate-100 border-2 border-slate-300 rounded-2xl font-black text-xl hover:bg-slate-200 transition shadow-md active:scale-95 flex items-center gap-2">
                    <ArrowLeft size={24} /> Quay lại danh sách mã đề
                  </button>
                  
                  <button onClick={() => handleExportWord()} className="px-14 py-5 bg-slate-950 text-white rounded-2xl font-black text-2xl hover:bg-slate-900 transition shadow-2xl active:scale-95 flex items-center gap-2">
                    <Download size={24} /> Xuất file Word mã đề này
                  </button>
                </div>
              </footer>
            </div>
          )}
        </main>

        <footer className="text-center text-black text-[11px] font-black uppercase tracking-[0.2em] pt-16 pb-24 print:hidden flex flex-col gap-2">
          <div>HỆ THỐNG SOẠN VÀ TRỘN ĐỀ THÔNG MINH - SMART TEST PRO</div>
          <div className="text-[9px] text-black font-black tracking-normal">BẢN QUYỀN: THẦY NGUYỄN TRẦM KHA - GV TRƯỜNG THCS&THPT NAM YÊN, AN GIANG - ĐT: 0917.548.463</div>
        </footer>
      </div>
    </div>
  );
};

export default App;
