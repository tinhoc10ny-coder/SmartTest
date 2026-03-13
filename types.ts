
export enum QuestionType {
  MCQ = 'MCQ', // Multiple Choice
  TF = 'T/F',  // True/False
  SA = 'SA',   // Short Answer
  TL = 'TL'    // Tuluan (Essay)
}

export type Difficulty = 'Dễ' | 'Vừa phải' | 'Khó';

export interface Ratio {
  know: number;
  understand: number;
  apply: number;
}

export interface QuestionStructure {
  type: QuestionType;
  label: string;
  count: number;
  pointPer: number;
  essayPoints?: number[]; // Danh sách điểm cho từng câu tự luận
}

export interface TestConfig {
  subject: string;
  grade: string;
  testName: string;
  bookSeries: string;
  difficulty: Difficulty;
  ratios: Ratio;
  structure: QuestionStructure[];
  topics: string[];
  orientation?: 'ICT' | 'CS' | 'Công nghiệp' | 'Nông nghiệp'; // Định hướng Tin học hoặc Công nghệ 10-12
}

export interface TopicSpec {
  topic: string;
  requirement: string; // Yêu cầu cần đạt cho chủ đề này
}

export interface GeneratedQuestion {
  id: number;
  type: QuestionType;
  level: string;
  content: string;
  topic?: string; 
  options?: string[]; 
  subItems?: string[]; 
  answer: string | string[]; 
  imageUrl?: string; // Trường mới lưu base64 ảnh minh họa
  lockShuffle?: boolean; // Khóa vị trí câu hỏi
  lockOptions?: boolean[]; // Khóa vị trí từng phương án
}

export interface GeneratedTest {
  title: string;
  metadata: {
    subject: string;
    grade: string;
    book: string;
    orientation?: string;
  };
  questions: GeneratedQuestion[];
  topicSpecifications: TopicSpec[]; // Danh sách yêu cầu cần đạt theo chủ đề
  testCode?: string;
}
