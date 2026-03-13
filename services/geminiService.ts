
import { GoogleGenAI, Type } from "@google/genai";
import { TestConfig, GeneratedTest, QuestionType } from "../types";

const getApiKey = () => {
  return localStorage.getItem('GEMINI_API_KEY') || process.env.GEMINI_API_KEY || '';
};

export const getTopicSuggestions = async (config: Partial<TestConfig>): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const hasOrientation = (config.subject === 'Tin học' || config.subject === 'Công nghệ') && ['10', '11', '12'].includes(config.grade || '');
  const orientationText = hasOrientation && config.orientation ? ` (Định hướng: ${config.orientation})` : '';
  
  const prompt = `Dựa trên chương trình GDPT 2018 của Việt Nam:
  - Môn: ${config.subject}${orientationText}
  - Lớp: ${config.grade}
  - Bộ sách: ${config.bookSeries}
  - Loại bài thi: ${config.testName}
  
  YÊU CẦU NGHIÊM NGẶT VỀ ĐỘ CHÍNH XÁC:
  1. CHỈ liệt kê các chủ đề hoặc bài học trọng tâm CÓ TRONG bộ sách "${config.bookSeries}" của ĐÚNG Lớp ${config.grade}.
  2. TUYỆT ĐỐI KHÔNG gợi ý nội dung của các khối lớp khác. Ví dụ: Nếu là Lớp 10, không được lấy bài của Lớp 11 hay Lớp 12.
  3. SỬ DỤNG Google Search để xác minh danh mục bài học của bộ sách "${config.bookSeries}" môn ${config.subject} lớp ${config.grade} trước khi trả về kết quả.
  4. Các chủ đề phải bám sát nội dung cốt lõi thường xuất hiện trong bài thi "${config.testName}".
  
  Hãy trả về mảng JSON các chuỗi tiêu đề bài học (khoảng 5-8 chủ đề).`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', // Nâng cấp lên Pro để suy luận tốt hơn về chương trình học
    contents: prompt,
    config: {
      systemInstruction: "Bạn là chuyên gia giáo dục am hiểu sâu sắc chương trình GDPT 2018 và các bộ sách giáo khoa (Kết nối tri thức, Cánh diều, Chân trời sáng tạo) tại Việt Nam. Bạn phải phân biệt rõ ràng kiến thức giữa các khối lớp và bộ sách. Bạn có nhiệm vụ tra cứu chính xác mục lục sách giáo khoa để gợi ý đúng bài học.",
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  return JSON.parse(response.text || '[]');
};

export const generateIllustration = async (questionContent: string, subject: string): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const prompt = `Tạo một hình minh họa chuyên nghiệp, đơn giản và mang tính giáo dục cho câu hỏi môn ${subject} sau: "${questionContent}". 
  Yêu cầu: Phong cách vẽ kỹ thuật hoặc sơ đồ học thuật, nền trắng sạch sẽ, không có chữ rối mắt, phù hợp để in trong đề kiểm tra học đường.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null;
};

export const generateTest = async (config: TestConfig): Promise<GeneratedTest> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const hasOrientation = (config.subject === 'Tin học' || config.subject === 'Công nghệ') && ['10', '11', '12'].includes(config.grade);
  const orientationText = hasOrientation && config.orientation ? ` (Định hướng: ${config.orientation})` : '';
  
  const structureDetails = config.structure
    .filter(s => s.count > 0)
    .map(s => {
      if (s.type === QuestionType.TL && s.essayPoints && s.essayPoints.length > 0) {
        const pointsStr = s.essayPoints.map((p, i) => `Câu ${i + 1} (${p} điểm)`).join(', ');
        return `- PHẦN ${s.label} (${s.type}): Tạo CHÍNH XÁC ${s.count} câu hỏi tự luận với phân bổ điểm: ${pointsStr}.`;
      }
      return `- PHẦN ${s.label} (${s.type}): Tạo CHÍNH XÁC ${s.count} câu hỏi.`;
    })
    .join('\n');

  const prompt = `Hãy tạo một đề kiểm tra chuyên nghiệp bám sát GDPT 2018 và Công văn 7991/BGDĐT-GDTrH dựa trên các thông số sau:
  - Tên bài thi: ${config.testName}
  - Môn: ${config.subject}${orientationText}
  - Lớp: ${config.grade}
  - Bộ sách: ${config.bookSeries}
  - Độ khó: ${config.difficulty}
  - Ma trận kiến thức: Nhận biết ${config.ratios.know}%, Thông hiểu ${config.ratios.understand}%, Vận dụng ${config.ratios.apply}%.
  - Chủ đề mục tiêu: ${config.topics.join(', ')}
  
  YÊU CẦU NGHIÊM NGẶT VỀ ĐỘ CHÍNH XÁC:
  1. TẤT CẢ câu hỏi phải phù hợp CHÍNH XÁC với trình độ kiến thức của học sinh Lớp ${config.grade} theo chương trình của bộ sách ${config.bookSeries}.
  2. KIỂM TRA CÔNG CỤ/NGÔN NGỮ: Đối với môn Tin học, bạn phải sử dụng đúng công cụ theo khối lớp:
     - Lớp 6, 7, 8, 9: Sử dụng Scratch (ngôn ngữ lập trình kéo thả), KHÔNG dùng Python/C++.
     - Lớp 10, 11, 12: Sử dụng Python hoặc C++ tùy theo định hướng.
  3. Nếu "Chủ đề mục tiêu" có tên tương tự ở các lớp khác, bạn PHẢI điều chỉnh nội dung câu hỏi sao cho đúng với yêu cầu cần đạt của Lớp ${config.grade}. Tuyệt đối không lấy kiến thức của lớp cao hơn hoặc thấp hơn.
  4. Nội dung phải thực tế, khoa học và bám sát đời sống theo tinh thần đổi mới của GDPT 2018.
  5. CÔNG THỨC TOÁN HỌC: TẤT CẢ các công thức toán học, ký hiệu khoa học PHẢI được viết bằng định dạng LaTeX, bao quanh bởi dấu $ (ví dụ: $x^2 + y^2 = r^2$, $\\sqrt{x}$, $\\frac{a}{b}$). Điều này cực kỳ quan trọng để hiển thị đúng và hỗ trợ MathType/Equation trong Word.

  YÊU CẦU CẤU TRÚC DỮ LIỆU CỰC KỲ NGHIÊM NGẶT:
  1. SỐ LƯỢNG CÂU HỎI: PHẢI tạo ĐỦ và ĐÚNG số lượng câu hỏi sau:
  ${structureDetails}
  => TỔNG CỘNG MẢNG "questions" PHẢI CÓ ${config.structure.reduce((a, b) => a + b.count, 0)} PHẦN TỬ.
  
  2. CHI TIẾT TỪNG LOẠI CÂU (BẮT BUỘC TUÂN THỦ):
     - MCQ (Trắc nghiệm nhiều phương án): 'options' PHẢI có 4 lựa chọn. 'answer' PHẢI là ["A"] hoặc ["B"] hoặc ["C"] hoặc ["D"].
     - T/F (Trắc nghiệm Đúng/Sai): Trường 'content' là câu dẫn (thân câu hỏi). Trường 'subItems' PHẢI LÀ MẢNG CÓ CHÍNH XÁC 4 PHÁT BIỂU (a, b, c, d). Trường 'answer' PHẢI LÀ MẢNG CÓ CHÍNH XÁC 4 GIÁ TRỊ tương ứng với 4 phát biểu đó, mỗi giá trị chỉ được là "Đúng" hoặc "Sai".
     - SA (Trắc nghiệm Trả lời ngắn): Trường 'content' là câu dẫn. Trường 'subItems' PHẢI LÀ MẢNG CÓ CHÍNH XÁC 4 Ý HỎI NHỎ (a, b, c, d). Trường 'answer' PHẢI LÀ MẢNG CÓ CHÍNH XÁC 4 ĐÁP ÁN tương ứng.
     - TL (Tự luận): 'answer' là mảng 1 phần tử chứa hướng dẫn chấm chi tiết.
  
  3. TRÌNH BÀY: 
     - KHÔNG tự thêm các ký tự "A.", "B.", "a)", "1." vào trong chuỗi văn bản của options, subItems hay content.
     - "title" phải chứa cụm từ "${config.testName}".`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: "Bạn là một chuyên gia khảo thí am hiểu sâu sắc chương trình GDPT 2018 Việt Nam. Bạn có khả năng tra cứu và xác nhận nội dung chính xác của từng bộ sách giáo khoa để đảm bảo không nhầm lẫn kiến thức giữa các khối lớp (ví dụ: Tin học 8 học Scratch, không học Python).",
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          metadata: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              grade: { type: Type.STRING },
              book: { type: Type.STRING }
            },
            required: ["subject", "grade", "book"]
          },
          topicSpecifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                requirement: { type: Type.STRING }
              },
              required: ["topic", "requirement"]
            }
          },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                type: { type: Type.STRING },
                level: { type: Type.STRING },
                topic: { type: Type.STRING },
                content: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                subItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING }
                }
              },
              required: ["id", "type", "level", "topic", "content", "answer"]
            }
          }
        },
        required: ["title", "metadata", "questions", "topicSpecifications"]
      }
    }
  });

  let parsed = JSON.parse(response.text || '{}') as GeneratedTest;

  // HẬU XỬ LÝ (POST-PROCESSING) CỰC KỲ NGHIÊM NGẶT ĐỂ ĐẢM BẢO GIAO DIỆN KHÔNG LỖI
  parsed.questions = (parsed.questions || []).map(q => {
    // 1. MCQ: Đảm bảo 4 options và 1 đáp án chuẩn
    if (q.type === QuestionType.MCQ || q.type.toString() === 'MCQ') {
      if (!Array.isArray(q.options)) q.options = [];
      while (q.options.length < 4) q.options.push(`Lựa chọn ${String.fromCharCode(65 + q.options.length)}...`);
      q.options = q.options.slice(0, 4);

      if (!Array.isArray(q.answer) || q.answer.length === 0) {
        q.answer = ["A"];
      } else {
        const first = q.answer[0].toString().trim().toUpperCase().charAt(0);
        q.answer = [["A", "B", "C", "D"].includes(first) ? first : "A"];
      }
    }
    
    // 2. T/F (Đúng Sai): Đảm bảo CHÍNH XÁC 4 ý thành phần
    if (q.type === QuestionType.TF || q.type.toString() === 'T/F') {
      if (!Array.isArray(q.subItems)) q.subItems = [];
      while (q.subItems.length < 4) {
        q.subItems.push(`Phát biểu ý ${String.fromCharCode(97 + q.subItems.length)} (AI chưa soạn đủ nội dung)...`);
      }
      q.subItems = q.subItems.slice(0, 4);

      if (!Array.isArray(q.answer)) q.answer = [];
      while (q.answer.length < 4) q.answer.push("Đúng");
      q.answer = q.answer.slice(0, 4).map(a => a.toString().includes("Sai") ? "Sai" : "Đúng");
    }

    // 3. SA (Trả lời ngắn): Đảm bảo CHÍNH XÁC 4 ý thành phần
    if (q.type === QuestionType.SA || q.type.toString() === 'SA') {
      if (!Array.isArray(q.subItems)) q.subItems = [];
      while (q.subItems.length < 4) {
        q.subItems.push(`Câu hỏi ý ${String.fromCharCode(97 + q.subItems.length)} (AI chưa soạn đủ nội dung)...`);
      }
      q.subItems = q.subItems.slice(0, 4);

      if (!Array.isArray(q.answer)) q.answer = [];
      while (q.answer.length < 4) q.answer.push("0");
      q.answer = q.answer.slice(0, 4);
    }

    return q;
  });

  // Chỉ gán orientation nếu thỏa mãn điều kiện Môn Tin học/Công nghệ và Khối 10-12
  if (hasOrientation && config.orientation) {
    parsed.metadata.orientation = config.orientation;
  } else {
    // Đảm bảo không tồn tại trường orientation trong metadata nếu không thỏa điều kiện
    delete parsed.metadata.orientation;
  }
  
  if (parsed.title && !parsed.title.includes(config.testName)) {
    parsed.title = `${config.testName} - ${parsed.title}`;
  }

  return parsed;
};

export const parseExistingTest = async (fileContent: string, mediaParts: any[] = []): Promise<GeneratedTest> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const prompt = `Dưới đây là nội dung một đề kiểm tra (có thể bao gồm văn bản trích xuất, hình ảnh trang đề, công thức...). 
  Hãy trích xuất CHÍNH XÁC các câu hỏi và đáp án từ nội dung này để chuyển đổi sang định dạng JSON chuẩn.
  
  NỘI DUNG VĂN BẢN (NẾU CÓ):
  """
  ${fileContent}
  """
  
  YÊU CẦU TRÍCH XUẤT CỰC KỲ QUAN TRỌNG:
  1. Nhận diện loại câu hỏi: MCQ, T/F, SA, TL.
  2. CÔNG THỨC TOÁN HỌC: Nếu bạn thấy công thức trong hình ảnh hoặc văn bản, hãy chuyển đổi chúng sang định dạng LaTeX chuẩn (ví dụ: $...$). Đảm bảo công thức chính xác 100% so với bản gốc.
  3. Trích xuất đáp án: Tìm phần đáp án để điền vào trường 'answer'.
  4. Phân loại: Tự suy luận 'level' và 'topic' dựa trên nội dung.
  5. Cấu trúc JSON: Phải tuân thủ nghiêm ngặt schema.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { text: prompt },
        ...mediaParts
      ]
    },
    config: {
      systemInstruction: "Bạn là một chuyên gia số hóa học liệu có khả năng thị giác máy tính xuất sắc. Bạn có thể đọc hiểu các công thức toán học phức tạp từ hình ảnh và chuyển đổi chúng sang LaTeX chính xác.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          metadata: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              grade: { type: Type.STRING },
              book: { type: Type.STRING }
            },
            required: ["subject", "grade", "book"]
          },
          topicSpecifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                requirement: { type: Type.STRING }
              },
              required: ["topic", "requirement"]
            }
          },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                type: { type: Type.STRING },
                level: { type: Type.STRING },
                topic: { type: Type.STRING },
                content: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                subItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING }
                }
              },
              required: ["id", "type", "level", "topic", "content", "answer"]
            }
          }
        },
        required: ["title", "metadata", "questions", "topicSpecifications"]
      }
    }
  });

  let parsed = JSON.parse(response.text || '{}') as GeneratedTest;

  // HẬU XỬ LÝ (POST-PROCESSING) tương tự generateTest để đảm bảo tính nhất quán
  parsed.questions = (parsed.questions || []).map(q => {
    if (q.type === QuestionType.MCQ || q.type.toString() === 'MCQ') {
      if (!Array.isArray(q.options)) q.options = [];
      while (q.options.length < 4) q.options.push(`Lựa chọn ${String.fromCharCode(65 + q.options.length)}...`);
      q.options = q.options.slice(0, 4);
      if (!Array.isArray(q.answer) || q.answer.length === 0) q.answer = ["A"];
    }
    
    if (q.type === QuestionType.TF || q.type.toString() === 'T/F') {
      if (!Array.isArray(q.subItems)) q.subItems = [];
      while (q.subItems.length < 4) q.subItems.push(`Phát biểu ý ${String.fromCharCode(97 + q.subItems.length)}...`);
      q.subItems = q.subItems.slice(0, 4);
      if (!Array.isArray(q.answer)) q.answer = [];
      while (q.answer.length < 4) q.answer.push("Đúng");
      q.answer = q.answer.slice(0, 4).map(a => a.toString().includes("Sai") ? "Sai" : "Đúng");
    }

    if (q.type === QuestionType.SA || q.type.toString() === 'SA') {
      if (!Array.isArray(q.subItems)) q.subItems = [];
      while (q.subItems.length < 4) q.subItems.push(`Câu hỏi ý ${String.fromCharCode(97 + q.subItems.length)}...`);
      q.subItems = q.subItems.slice(0, 4);
      if (!Array.isArray(q.answer)) q.answer = [];
      while (q.answer.length < 4) q.answer.push("0");
      q.answer = q.answer.slice(0, 4);
    }

    return q;
  });

  return parsed;
};
