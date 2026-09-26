/* ============================================================
   JLPT 个人题库 — 核心逻辑（零依赖，纯原生 JS）
   ============================================================ */
(function () {
  "use strict";

  // 音频地址前缀：默认空（audio/ 相对路径）。对象存储部署时改为存储域名，或用 ?audio_base= 覆盖。
  // 音频托管：Cloudflare Pages。可用 ?audio_base= 临时覆盖。
  const AUDIO_BASE = (window.AUDIO_BASE || "https://jlpt-audio-6vc.pages.dev/") + (location.search.match(/[?&]audio_base=([^&]+)/) ? decodeURIComponent(location.search.match(/[?&]audio_base=([^&]+)/)[1]) : "");
  const LS_KEY = "jlpt-bank-v1";
  const LEVEL_ORDER = ["N5", "N4", "N3", "N2", "N1"];
  const LEVEL_COLOR = {
    N5: "var(--level-n5)", N4: "var(--level-n4)", N3: "var(--level-n3)",
    N2: "var(--level-n2)", N1: "var(--level-n1)"
  };

  // 筛选维度 -> 对应 state 里存放已选集合的复数键名
  // （注意 category 复数是 categories，不能简单用 group+"s"）
  const GROUP_SET = { level: "levels", category: "categories", yearMonth: "yearMonths" };

  /* ---------- 多语言 ---------- */
  const I18N = {
    zh: {
      appTitle: "JLPT 个人题库", appSubtitle: "真题 · 模拟 · 自编 · N5–N1",
      searchPlaceholder: "搜索题干 / 选项 / 解析 / 标签…",
      import: "导入", export: "导出试卷", exam: "随机组卷", backToBrowse: "返回浏览",
      level: "等级", category: "分类", source: "来源", audio: "听解音频",
      audioOnly: "仅显示含音频的题目", resetFilters: "重置筛选",
      year: "考试场次", examYear: "考试场次（可多选）",
      yearHintPickLevel: "请先选择等级",
      sort: "排序", sortLevelAsc: "等级 低→高", sortLevelDesc: "等级 高→低",
      sortId: "编号", sortRandom: "随机",
      emptyTitle: "没有匹配的题目。", emptyHint: "试试调整筛选条件，或导入更多题目。",
      emptyPickTitle: "请先选择筛选条件", emptyPickHint: "在左侧选择等级 / 分类 / 年份（或点各组的「全选」），即可开始刷题。",
      examDesc: "按条件随机抽取，生成专属试卷。",
      examLevel: "等级（可多选）", examCategory: "分类（可多选）", examSource: "来源（可多选）",
      questionCount: "题目数量", shuffleOptions: "打乱选项顺序",
      generate: "生成试卷", regenerate: "重新抽取",
      showAnswer: "显示答案", hideAnswer: "隐藏答案",
      print: "打印 / 导出PDF", exportJson: "导出JSON",
      importTitle: "导入题库", importDesc: "支持 JSON 文件。可从 data/import-template.json 复制格式。",
      dropHint: "点击选择文件，或拖拽到此处", localOnly: "仅解析本地文件，不会上传任何数据",
      mergeMode: "合并到现有题库", replaceMode: "替换现有题库",
      statTotal: "题库总量：{n} 题", statMatched: "当前匹配：{n} 题",
      resultCount: "共 {n} 道题", keyword: "关键词",
      collapse: "收起解析 ▲", showAnswerExp: "显示答案 / 解析 ▼",
      correctAnswer: "正确答案", explanation: "解析", all: "全部",
      examPaper: "模拟试卷 · {n} 题", levelLabel: "等级", categoryLabel: "分类",
      importOk: "成功导入 {n} 题（当前共 {total} 题）", importFail: "导入失败：{msg}",
      exported: "已导出 {n} 题", examExported: "已导出试卷 JSON",
      audioMark: "音频", emptyList: "没有可导出的题目",
      noQuestions: "当前条件下没有可用题目", genFirst: "请先生成试卷",
      tipLang: "切换显示语言", tipImport: "导入题库文件", tipExport: "导出当前题库为 Word",
      tipExam: "随机生成试卷", tipTheme: "切换主题（亮色 / 暗色）",
      backupHint: "已导入 {n} 题，建议立即备份到本地文件", backupNow: "立即备份", backupDismiss: "稍后",
      pasteImport: "粘贴导入", tipPaste: "粘贴文本，自动识别成题目",
      pasteTitle: "粘贴导入题目", pasteDesc: "把整理好的题目粘贴到下方。格式：一行题干，紧接着选项（用 1,2,3,4 编号，可以每行一个，也可以写在同一行用空格隔开），空一行接下一题。可标注「答案：3」「解析：…」。识别后可逐题核对再保存。",
      pasteLevel: "等级", pasteCategory: "分类", pasteSource: "来源",
      pasteParse: "解析并预览", pasteClear: "清空", pasteSave: "保存到题库",
      pastePreview: "预览（共 {n} 题）", pasteSelected: "已选 {n} 题", pasteEmpty: "没有解析到题目，请检查格式。",
      pasteInclude: "包含", pasteAnswer: "答案", pasteNoAnswer: "未标注", pasteExplanation: "解析（可选）",
      pasteQuestion: "题干", pasteOption: "选项", pasteSaved: "已保存 {n} 题到题库", pasteExample: "在此粘贴题目文本…",
      pasteImages: "附加图片", pasteDragImages: "点击选择或拖拽图片到此（可多选，支持 png/jpg/gif/webp）",
      pasteImage: "图片", pasteNoImage: "无",       pasteImgHint: "小贴士：文本框里用「图：文件名」可把图片关联为题干图；选项图片请在下方预览里逐题选择。",
      pasteImgRemove: "移除",
      pasteQImage: "题干图片",
      pasteOptImage: "选项图片",
      pasteAutoImg: "按附件顺序自动填充图片",
      pasteQImageHint: "整道题本身就是一张图时，留空题干，把图片选到这里",
      pasteOptImageHint: "该选项是一张图时使用",
      pasteImgFillHint: "按附件顺序：先分配给空题干，再分配给空选项",
      selectAll: "全选",
      pasteSample: "查看格式示例",
      pasteDelete: "删除",
      errArray: "文件顶层必须是 JSON 数组",
      errFields: "有 {n} 条缺少 id 或 question 字段"
    },
    en: {
      appTitle: "JLPT Question Bank", appSubtitle: "Past · Mock · Custom · N5–N1",
      searchPlaceholder: "Search question / options / explanation / tags…",
      import: "Import", export: "Export Exam", exam: "Generate Exam", backToBrowse: "Back to Browse",
      level: "Level", category: "Category", source: "Source", audio: "Listening Audio",
      audioOnly: "Only show questions with audio", resetFilters: "Reset Filters",
      year: "Exam session", examYear: "Exam session (multi-select)",
      yearHintPickLevel: "Select a level first",
      sort: "Sort", sortLevelAsc: "Level low→high", sortLevelDesc: "Level high→low",
      sortId: "ID", sortRandom: "Random",
      emptyTitle: "No matching questions.", emptyHint: "Try adjusting filters, or import more questions.",
      emptyPickTitle: "Pick your filters first", emptyPickHint: "Select level / category / year on the left (or tap “Select all”), then questions will appear.",
      examDesc: "Randomly draw questions by criteria to build your exam.",
      examLevel: "Level (multi-select)", examCategory: "Category (multi-select)", examSource: "Source (multi-select)",
      questionCount: "Number of questions", shuffleOptions: "Shuffle option order",
      generate: "Generate Exam", regenerate: "Redraw",
      showAnswer: "Show Answers", hideAnswer: "Hide Answers",
      print: "Print / Export PDF", exportJson: "Export JSON",
      importTitle: "Import Bank", importDesc: "JSON file only. Copy the format from data/import-template.json.",
      dropHint: "Click to choose a file, or drag it here", localOnly: "Files are parsed locally; nothing is uploaded",
      mergeMode: "Merge into current bank", replaceMode: "Replace current bank",
      statTotal: "Total: {n} questions", statMatched: "Matched: {n}",
      resultCount: "Total {n} questions", keyword: "keyword",
      collapse: "Hide explanation ▲", showAnswerExp: "Show answer / explanation ▼",
      correctAnswer: "Correct answer", explanation: "Explanation", all: "All",
      examPaper: "Practice Exam · {n}", levelLabel: "Level", categoryLabel: "Category",
      importOk: "Imported {n} questions (now {total} total)", importFail: "Import failed: {msg}",
      exported: "Exported {n} questions", examExported: "Exam exported as JSON",
      audioMark: "Audio", emptyList: "No questions to export",
      noQuestions: "No questions match the current criteria", genFirst: "Generate an exam first",
      tipLang: "Switch display language", tipImport: "Import a question file", tipExport: "Export the current bank",
      tipExam: "Generate a random exam", tipTheme: "Toggle light / dark theme",
      backupHint: "Imported {n} questions — back them up to a local file now", backupNow: "Backup now", backupDismiss: "Later",
      pasteImport: "Paste Import", tipPaste: "Paste text and auto-detect questions",
      pasteTitle: "Paste Questions", pasteDesc: "Paste your organized questions below. Format: one line for the question, then options numbered 1,2,3,4 (one per line, or space-separated on one line), blank line between questions. You may add “answer: 3” / “explanation: …”. Review each item before saving.",
      pasteLevel: "Level", pasteCategory: "Category", pasteSource: "Source",
      pasteParse: "Parse & Preview", pasteClear: "Clear", pasteSave: "Save to Bank",
      pastePreview: "Preview ({n} questions)", pasteSelected: "{n} selected", pasteEmpty: "No questions detected — check the format.",
      pasteInclude: "Include", pasteAnswer: "Answer", pasteNoAnswer: "Unmarked", pasteExplanation: "Explanation (optional)",
      pasteQuestion: "Question", pasteOption: "Options", pasteSaved: "Saved {n} questions to the bank", pasteExample: "Paste question text here…",
      pasteImages: "Attach images", pasteDragImages: "Click to choose or drag images here (multiple allowed; png/jpg/gif/webp)",
      pasteImage: "Image", pasteNoImage: "None",       pasteImgHint: "Tip: in the text use “image: filename” to link an image as the question picture; choose option pictures per-card below.",
      pasteImgRemove: "Remove",
      pasteQImage: "Question image",
      pasteOptImage: "Option image",
      pasteAutoImg: "Auto-fill images by attachment order",
      pasteQImageHint: "When the whole question is a picture, leave the text blank and choose the image here",
      pasteOptImageHint: "Use when this option itself is a picture",
      pasteImgFillHint: "In attachment order: empty question images first, then empty option images",
      selectAll: "Select all",
      pasteSample: "View format example",
      pasteDelete: "Delete",
      errArray: "The top level of the file must be a JSON array",
      errFields: "There are {n} items missing the id or question field"
    },
    ja: {
      appTitle: "JLPT 問題集", appSubtitle: "過去問・模試・自作・N5–N1",
      searchPlaceholder: "問題文 / 選択肢 / 解説 / タグ を検索…",
      import: "インポート", export: "試験出力", exam: "試験を生成", backToBrowse: "一覧に戻る",
      level: "級", category: "分野", source: "出典", audio: "リスニング音声",
      audioOnly: "音声付きの問題のみ表示", resetFilters: "絞り込みをリセット",
      year: "試験回", examYear: "試験回（複数選択）",
      yearHintPickLevel: "まず級を選択してください",
      sort: "並び替え", sortLevelAsc: "級 低→高", sortLevelDesc: "級 高→低",
      sortId: "番号", sortRandom: "ランダム",
      emptyTitle: "該当する問題がありません。", emptyHint: "絞り込みを変更するか、問題をインポートしてください。",
      emptyPickTitle: "絞り込み条件を選択してください", emptyPickHint: "左側で級・分野・年度を選ぶ（または各グループの「すべて選択」）と問題が表示されます。",
      examDesc: "条件に合わせてランダムに抽出し、オリジナル試験を作成します。",
      examLevel: "級（複数選択）", examCategory: "分野（複数選択）", examSource: "出典（複数選択）",
      questionCount: "問題数", shuffleOptions: "選択肢の順序をシャッフル",
      generate: "試験を生成", regenerate: "再抽出",
      showAnswer: "解答を表示", hideAnswer: "解答を非表示",
      print: "印刷 / PDF出力", exportJson: "JSON出力",
      importTitle: "問題のインポート", importDesc: "JSON ファイルのみ。形式は data/import-template.json を参照。",
      dropHint: "クリックで選択、またはここにドラッグ", localOnly: "ファイルは端末内で処理され、アップロードされません",
      mergeMode: "現在の問題に統合", replaceMode: "現在の問題を置換",
      statTotal: "問題総数：{n} 問", statMatched: "現在の一致：{n} 問",
      resultCount: "{n} 問", keyword: "キーワード",
      collapse: "解説を閉じる ▲", showAnswerExp: "解答 / 解説を表示 ▼",
      correctAnswer: "正解", explanation: "解説", all: "すべて",
      examPaper: "模擬試験・{n}問", levelLabel: "級", categoryLabel: "分野",
      importOk: "{n} 問をインポートしました（全体 {total} 問）", importFail: "インポート失敗：{msg}",
      exported: "{n} 問をエクスポートしました", examExported: "試験をJSONで出力しました",
      audioMark: "音声", emptyList: "出力する問題がありません",
      noQuestions: "条件に合う問題がありません", genFirst: "まず試験を生成してください",
      tipLang: "表示言語を切り替え", tipImport: "問題ファイルをインポート", tipExport: "現在の問題をエクスポート",
      tipExam: "ランダムに試験を生成", tipTheme: "テーマを切り替え（ライト / ダーク）",
      backupHint: "{n} 問をインポートしました。今すぐローカルファイルにバックアップすることをお勧めします", backupNow: "今すぐバックアップ", backupDismiss: "後で",
      pasteImport: "貼り付け取り込み", tipPaste: "テキストを貼り付けて問題を自動検出",
      pasteTitle: "問題の貼り付け取り込み", pasteDesc: "整理した問題を下に貼り付けます。形式：問題文を1行、その後に選択肢を1,2,3,4で番号付け（1行に1つ、または同じ行で空白区切り）、問題間は空行。必要に応じ「答え：3」「解説：…」を記載。保存前に各項目を確認してください。",
      pasteLevel: "級", pasteCategory: "分野", pasteSource: "出典",
      pasteParse: "解析してプレビュー", pasteClear: "クリア", pasteSave: "問題集に保存",
      pastePreview: "プレビュー（{n} 問）", pasteSelected: "{n} 問選択", pasteEmpty: "問題が検出されませんでした。形式を確認してください。",
      pasteInclude: "含める", pasteAnswer: "答え", pasteNoAnswer: "未記入", pasteExplanation: "解説（任意）",
      pasteQuestion: "問題文", pasteOption: "選択肢", pasteSaved: "{n} 問を問題集に保存しました", pasteExample: "ここに問題文を貼り付け…",
      pasteImages: "画像を添付", pasteDragImages: "クリックまたはドラッグで画像を追加（複数可・png/jpg/gif/webp）",
      pasteImage: "画像", pasteNoImage: "なし", pasteImgHint: "ヒント：テキスト内で「図：ファイル名」と書くと題画像に紐付きます。選択肢画像は下のプレビューで各問題ごとに選択してください。",
      pasteImgRemove: "削除",
      pasteQImage: "問題画像",
      pasteOptImage: "選択肢画像",
      pasteAutoImg: "添付順に画像を自動割当",
      pasteQImageHint: "問題全体が画像の場合は問題文を空にしてここで画像を選択",
      pasteOptImageHint: "この選択肢が画像の場合に使用",
      pasteImgFillHint: "添付順：空の問題画像→空の選択肢画像",
      selectAll: "すべて選択",
      pasteSample: "形式例を表示",
      pasteDelete: "削除",
      errArray: "ファイルの最上位は JSON 配列である必要があります",
      errFields: "{n} 件に id または question フィールドがありません"
    },
    labels: {
      "文字词汇": { zh: "文字词汇", en: "Vocabulary", ja: "語彙" },
      "语法":     { zh: "语法",     en: "Grammar",    ja: "文法" },
      "读解":     { zh: "读解",     en: "Reading",    ja: "読解" },
      "听解":     { zh: "听解",     en: "Listening",  ja: "聴解" },
      "真题":     { zh: "真题",     en: "Past Papers",ja: "過去問" }
    }
  };

  // 数据值（分类 / 来源）的本地化显示；内部值仍保留用于筛选与存储
  function labelOf(group, v) {
    if ((group === "category" || group === "source") && I18N.labels && I18N.labels[v]) {
      const m = I18N.labels[v];
      return m[state.lang] || m.zh || v;
    }
    return v;
  }

  // 年月考次：mojidict 真题 id 前缀为 YYYYMM（如 201007=2010年7月），由此解析；
  // 自编/模拟题无此前缀时退回 year 字段。
  function yearMonthOf(q) {
    const m = (q.id || "").match(/^(\d{4})(\d{2})/);
    if (m) return { year: +m[1], month: +m[2] };
    return { year: q.year || null, month: null };
  }
  function ymKey(q) {
    const ym = yearMonthOf(q);
    if (ym.year == null) return null;
    return ym.month != null ? ym.year + "-" + String(ym.month).padStart(2, "0") : String(ym.year);
  }
  const EN_MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // key 形如 "2010-07"；返回本地化考次标签
  function ymLabel(key, lang) {
    if (!key) return "";
    const p = key.split("-");
    const y = p[0], m = p[1];
    if (!m) return lang === "en" ? y : y + "年";
    const mo = +m;
    if (lang === "en") return EN_MONTHS[mo] + " " + y;
    return y + "年" + mo + "月";
  }
  // 卡片来源小标签配套：真题 2010年7月（无月份则退回「真题 2010」）
  function ymBadge(q, lang) {
    const k = ymKey(q);
    if (!k) return "";
    return " " + ymLabel(k, lang);
  }

  function t(key, params) {
    let s = (I18N[state.lang] && I18N[state.lang][key]) || (I18N.zh[key]) || key;
    if (params) for (const k in params) s = s.replace("{" + k + "}", params[k]);
    return s;
  }

  function applyLang() {
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : state.lang;
    document.body.setAttribute("data-ui-lang", state.lang);
    document.title = t("appTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.getAttribute("data-i18n-placeholder")); });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.getAttribute("data-i18n-title")); });
    // 视图相关动态文本
    $("#btn-exam").textContent = state.view === "exam" ? t("backToBrowse") : t("exam");
    $("#btn-exam").title = t("tipExam");
    // 重新渲染筛选 chip 的本地化文字（考次标签随语言变化；保留已选状态）
    ["level", "category"].forEach((g) => {
      if (!$("#filter-" + g)) return;
      const vals = uniqueValues(g);
      renderChips("filter-" + g, vals, state.filters[GROUP_SET[g]], g);
      renderChips("exam-" + g, vals, state.examFilters[GROUP_SET[g]], g, g === "level" ? undefined : "exam");
    });
    // 年份（考次）标签随语言变化，但年份集合依赖等级 —— 用 renderYearChips 重建
    renderYearChips("filter");
    renderYearChips("exam");
    updateSidebarStat();
    renderList();
    if (state.view === "exam" && state.exam.questions.length) renderExam();
    try { localStorage.setItem(LS_KEY + "-lang", state.lang); } catch (e) {}
  }

  function setLang(lang) {
    if (!I18N[lang]) return;
    state.lang = lang;
    applyLang();
  }

  const $ = (sel) => document.querySelector(sel);

  const state = {
    questions: [],
    filters: { levels: new Set(), categories: new Set(), yearMonths: new Set(), audioOnly: false },
    examFilters: { levels: new Set(), categories: new Set(), yearMonths: new Set() },
    query: "",
    sort: "level-asc",
    view: "browse",
    theme: "light",
    lang: "zh",
    expanded: new Set(),
    exam: { questions: [], showAnswer: false, shuffle: false }
  };

  /* ---------- 持久化 ---------- */
  async function loadData() {
    // 主题 / 语言记忆（与题库无关，先读好）
    state.theme = (function () { try { return localStorage.getItem(LS_KEY + "-theme") || "light"; } catch (e) { return "light"; } })();
    state.lang = (function () { try { return localStorage.getItem(LS_KEY + "-lang") || "zh"; } catch (e) { return "zh"; } })();

    // 优先从本地服务器的文件题库加载（data/questions.json），这样换浏览器/换电脑只要带着文件夹即可
    let fileLoaded = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const resp = await fetch("/api/load", { signal: ctrl.signal });
      clearTimeout(timer);
      if (resp.ok) {
        const arr = await resp.json();
        if (Array.isArray(arr) && arr.length) {
          state.questions = arr.map(normalize);
          saveData(); // 同步到 localStorage 作为缓存
          fileLoaded = true;
        }
      }
    } catch (e) { /* 直接 file:// 打开、没有服务器时静默回退 */ }

    if (!fileLoaded) {
      // 离线内置真题（data/questions.js）优先于浏览器 localStorage 缓存，
      // 避免早期把示例题存进 localStorage 后一直覆盖真题。
      const embedded = window.__QUESTIONS__ || [];
      if (embedded.length) {
        state.questions = embedded.map(normalize);
        saveData();
      } else {
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) {}
        if (Array.isArray(stored) && stored.length) {
          state.questions = stored.map(normalize);
        } else {
          // 内置示例（已清空，作为干净起点）
          state.questions = (window.SEED_QUESTIONS || []).map(normalize);
          saveData();
        }
      }
    }
  }

  function saveData() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state.questions)); } catch (e) {}
    persistToFile(); // best-effort 落盘成文件
  }

  // 把题库 POST 到本地服务器，写成 data/questions.json（无服务器时静默忽略）
  function persistToFile() {
    if (!state.questions.length) return;
    try {
      fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.questions)
      }).catch(() => {});
    } catch (e) { /* 无服务器时忽略 */ }
  }

  function normalize(q) {
    return {
      id: String(q.id != null ? q.id : ""),
      level: String(q.level || "N?"),
      category: String(q.category || "未分类"),
      type: String(q.type || ""),
      question: String(q.question || ""),
      questionNumber: (q.questionNumber != null && !isNaN(q.questionNumber)) ? Number(q.questionNumber) : null,
      problemNumber: (q.problemNumber != null && !isNaN(q.problemNumber)) ? Number(q.problemNumber) : null,
      article: q.article || null,
      articleGroup: q.articleGroup || null,
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      optionImages: Array.isArray(q.optionImages) ? q.optionImages.map((v) => (v || null)) : (Array.isArray(q.options) ? q.options.map(() => null) : []),
      answer: (typeof q.answer === "number") ? q.answer : (q.answer != null ? String(q.answer) : ""),
      explanation: String(q.explanation || ""),
      tags: Array.isArray(q.tags) ? q.tags.map(String) : [],
      source: String(q.source || "未注明"),
      audioUrl: q.audioUrl || null,
      imageUrl: q.imageUrl || null,
      year: q.year != null ? Number(q.year) : null
    };
  }

  /* ---------- 工具 ----------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // 把题目里可能存在的 HTML（富文本/换行标签）转成纯文本，块级标签转换行，并解码实体
  function stripHtml(s) {
    if (!s) return "";
    return String(s)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  // 导出范围：有筛选条件时导出“当前可见题目”，否则导出整库
  function getExportList() {
    return filtersActive() ? getVisible() : state.questions;
  }

  function highlight(text, tokens) {
    const escaped = escapeHtml(text);
    if (!tokens.length) return escaped;
    const pattern = tokens
      .filter((t) => t)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    if (!pattern) return escaped;
    return escaped.replace(new RegExp("(" + pattern + ")", "gi"), "<mark>$1</mark>");
  }

  // 渲染富文本题干/文章/解析：保留真题里的 <u> 下划线标记（标注待考察词汇），
  // 其余内容照常转义防 XSS；并支持关键词高亮（不破坏已有标签）。
  function renderRich(text, tokens) {
    if (!text) return "";
    // 先把 <u> 标签隔离成占位符，避免被 escapeHtml 转义成 &lt;u&gt;
    let s = String(text).replace(/<u>/gi, "\x00U\x00").replace(/<\/u>/gi, "\x00/U\x00");
    s = escapeHtml(s);
    s = s.replace(/\x00U\x00/g, "<u>").replace(/\x00\/U\x00/g, "</u>");
    if (!tokens || !tokens.length) return s;
    const pattern = tokens
      .filter((t) => t)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    if (!pattern) return s;
    // 负向断言：不匹配 HTML 标签内部字符（如 <u> 的 u），避免破坏标签
    return s.replace(new RegExp("(" + pattern + ")(?![^<]*>)", "gi"), "<mark>$1</mark>");
  }

  function imageHtml(q) {
    return q.imageUrl
      ? '<div class="q-image"><img src="' + escapeHtml(q.imageUrl) + '" alt="题目图片" loading="lazy" /></div>'
      : "";
  }

  function getTokens(query) {
    return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function levelIndex(lv) {
    const i = LEVEL_ORDER.indexOf(lv);
    return i === -1 ? 99 : i;
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => (t.hidden = true), 220);
    }, 2200);
  }

  /* ---------- 筛选 / 搜索 ---------- */
  function uniqueValues(key) {
    const set = new Set(state.questions.map((q) => q[key]));
    if (key === "level") return LEVEL_ORDER.filter((l) => set.has(l));
    if (key === "year") return Array.from(set).filter((v) => v != null).sort((a, b) => a - b);
    if (key === "yearMonth") {
      const yms = new Set();
      for (const q of state.questions) { const k = ymKey(q); if (k) yms.add(k); }
      return Array.from(yms).sort(); // "YYYY-MM" 字典序即时间序
    }
    return Array.from(set).sort();
  }

  // 计算「在给定等级集合下实际存在的年份（考次）」。
  // 不同级别拥有的卷子年份不同（如 N4 没有 2011/2015…，N5 只有 2010/2012/2013/2018），
  // 因此不能一开始就列出所有年份，只能按已选等级动态显示，避免用户选到没有任何题的年份。
  // levelSet 为空（未选任何等级）时返回空数组 —— 年份区此时不渲染按钮。
  function yearMonthsForLevels(levelSet) {
    if (!levelSet || !levelSet.size) return [];
    const yms = new Set();
    for (const q of state.questions) {
      if (!levelSet.has(q.level)) continue;
      const k = ymKey(q);
      if (k) yms.add(k);
    }
    return Array.from(yms).sort();
  }

  function matchesFilters(q, f) {
    if (f.levels.size && !f.levels.has(q.level)) return false;
    if (f.categories.size && !f.categories.has(q.category)) return false;
    if (f.yearMonths && f.yearMonths.size && !f.yearMonths.has(ymKey(q))) return false;
    if (f.audioOnly && !q.audioUrl) return false;
    return true;
  }

  function searchScore(q, tokens) {
    if (!tokens.length) return 0;
    const hay = (
      q.question + " " + q.options.join(" ") + " " + q.explanation + " " + q.tags.join(" ") + " " + q.type
    ).toLowerCase();
    let ok = true;
    let score = 0;
    for (const tk of tokens) {
      if (hay.indexOf(tk) === -1) { ok = false; break; }
      if (q.question.toLowerCase().indexOf(tk) !== -1) score += 3;
      if (q.tags.join(" ").toLowerCase().indexOf(tk) !== -1) score += 2;
      if (q.options.join(" ").toLowerCase().indexOf(tk) !== -1) score += 2;
      if (q.explanation.toLowerCase().indexOf(tk) !== -1) score += 1.5;
    }
    return ok ? score : -1;
  }

  function filtersActive() {
    const f = state.filters;
    return !!(f.levels.size || f.categories.size ||
      (f.yearMonths && f.yearMonths.size) || f.audioOnly || state.query.trim());
  }

  function getVisible() {
    const tokens = getTokens(state.query);
    // 初始 / 完全未选任何筛选条件时，不渲染任何题目：
    // 避免一次性把海量卡片塞进页面造成卡顿，打开即空白、按需筛选。
    if (!filtersActive()) return [];
    let list = state.questions.filter((q) => matchesFilters(q, state.filters));
    if (tokens.length) {
      list = list
        .map((q) => ({ q, s: searchScore(q, tokens) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.q);
      return list;
    }
    // 排序
    if (state.sort === "random") return shuffle(list);
    list = list.slice().sort((a, b) => {
      if (state.sort === "level-asc") return levelIndex(a.level) - levelIndex(b.level) || a.id.localeCompare(b.id);
      if (state.sort === "level-desc") return levelIndex(b.level) - levelIndex(a.level) || a.id.localeCompare(b.id);
      // 默认：先按「卷」(年份月份) 升序，再按大题号 → 小题号，保证板块顺序正确
      // （小题号在每个大题内会重置为 1，不能单独作为全局排序键，否则文法大题会插到文字词汇中间）
      const ya = ymKey(a) || "", yb = ymKey(b) || "";
      if (ya !== yb) return ya < yb ? -1 : 1;
      const sa = (a.sectionIndex != null ? a.sectionIndex : (a.problemNumber != null ? a.problemNumber : 0));
      const sb = (b.sectionIndex != null ? b.sectionIndex : (b.problemNumber != null ? b.problemNumber : 0));
      if (sa !== sb) return sa - sb;
      const qa = (a.questionNumber != null ? a.questionNumber : 0);
      const qb = (b.questionNumber != null ? b.questionNumber : 0);
      return qa - qb;
    });
    return list;
  }

  /* ---------- 渲染：筛选 chip ---------- */
  function renderChips(containerId, values, selectedSet, group, which) {
    const c = $("#" + containerId);
    c.innerHTML = "";
    values.forEach((v) => {
      const el = document.createElement("span");
      el.className = "chip" + (selectedSet.has(v) ? " active" : "");
      el.textContent = (group === "yearMonth") ? ymLabel(v, state.lang) : labelOf(group, v);
      el.addEventListener("click", () => {
        if (selectedSet.has(v)) selectedSet.delete(v);
        else selectedSet.add(v);
        el.classList.toggle("active");
        // 等级变化 → 年份需随之重建（清空已选年份，按新等级显示可用年份）
        if (group === "level") onLevelChange(which || "filter");
        else if (state.view === "browse") renderList();
        updateSidebarStat();
      });
      c.appendChild(el);
    });
  }

  // 渲染年份（考次）chip。which: "filter"(浏览) | "exam"(组卷)
  // 年份依赖「已选等级」：仅列出所选等级交集下实际存在的年份；未选等级时显示占位提示、不渲染按钮。
  function renderYearChips(which) {
    const f = (which === "exam") ? state.examFilters : state.filters;
    const containerId = (which === "exam") ? "exam-yearMonth" : "filter-yearMonth";
    const c = $("#" + containerId);
    if (!c) return;
    c.innerHTML = "";
    const yms = yearMonthsForLevels(f.levels);
    // 年份区的「全选」按钮仅在已选等级时才可用
    const group = c.closest(".filter-group") || c.closest(".field");
    const toggleBtn = group && group.querySelector('[data-toggle-all="yearMonth"]');
    if (toggleBtn) toggleBtn.disabled = !yms.length;
    if (!yms.length) {
      const hint = document.createElement("span");
      hint.className = "chip-hint";
      hint.textContent = t("yearHintPickLevel");
      c.appendChild(hint);
      return;
    }
    yms.forEach((v) => {
      const el = document.createElement("span");
      el.className = "chip" + (f.yearMonths.has(v) ? " active" : "");
      el.textContent = ymLabel(v, state.lang);
      el.addEventListener("click", () => {
        if (f.yearMonths.has(v)) f.yearMonths.delete(v);
        else f.yearMonths.add(v);
        el.classList.toggle("active");
        if (state.view === "browse") renderList();
        updateSidebarStat();
      });
      c.appendChild(el);
    });
  }

  // 等级变化后：清空该视图已选年份（旧年份可能在新等级下无效），重建年份 chip。
  function onLevelChange(which) {
    const f = (which === "exam") ? state.examFilters : state.filters;
    f.yearMonths = new Set();
    renderYearChips(which);
    if (which === "filter" && state.view === "browse") renderList();
    updateSidebarStat();
  }

  function initFilters() {
    const levels = uniqueValues("level");
    const cats = uniqueValues("category");
    const yms = uniqueValues("yearMonth");
    state.filters.levels = new Set(levels);
    state.filters.categories = new Set(cats);
    state.filters.yearMonths = new Set(yms);
    state.examFilters.levels = new Set(levels);
    state.examFilters.categories = new Set(cats);
    state.examFilters.yearMonths = new Set(yms);

    renderChips("filter-level", levels, state.filters.levels, "level");
    renderChips("filter-category", cats, state.filters.categories, "category");

    renderChips("exam-level", levels, state.examFilters.levels, "level", "exam");
    renderChips("exam-category", cats, state.examFilters.categories, "category", "exam");

    // 年份按等级联动 —— 初始等级全选，年份随之全量；切换等级时会重建。
    renderYearChips("filter");
    renderYearChips("exam");
    updateSidebarStat();
  }

  function updateSidebarStat() {
    const total = state.questions.length;
    const visible = getVisible().length;
    $("#sidebar-stat").innerHTML =
      t("statTotal", { n: total }) + "<br>" + t("statMatched", { n: visible });
  }

  /* ---------- 列表分批渲染（无限滚动） ---------- */
  const PAGE_SIZE = 50;
  let currentList = [];
  let renderedCount = 0;
  let _io = null;
  let passageFirstIds = new Set(); // 篇章首题 id 集合：同一文章的多小题只在首题显示一次文章
  let lastRenderedYmLevel = null;   // 已渲染的最后一道题的「卷」标识，用于分组标题不重复插入

  function cardHtml(q, tokens, showArticle) {
    const expanded = state.expanded.has(q.id);
    const optsHtml = q.options.length
      ? '<div class="q-options">' + q.options.map((o, i) => {
          const correct = (typeof q.answer === "number") && i === q.answer;
          const oi = q.optionImages && q.optionImages[i];
          const inner = oi
            ? '<span class="opt-img"><img src="' + escapeHtml(oi) + '" alt="选项图片" loading="lazy" /></span>'
            : "<span>" + renderRich(o, tokens) + "</span>";
          return '<div class="opt' + (expanded && correct ? " correct" : "") + '">' +
            '<span class="mark">' + (i + 1) + "</span>" + inner + "</div>";
        }).join("") + "</div>"
      : "";
    const audioHtml = q.audioUrl
      ? '<div class="q-audio"><audio controls src="' + escapeHtml(AUDIO_BASE + q.audioUrl) + '"></audio></div>'
      : "";
    const expHtml = expanded
      ? '<div class="q-exp"><span class="label">' + t("explanation") + "</span>" + renderRich(q.explanation, tokens) + "</div>" +
        (q.tags.length ? '<div class="q-tags">' + q.tags.map((tg) =>
            '<span class="tag" data-tag="' + escapeHtml(tg) + '">#' + escapeHtml(tg) + "</span>").join("") + "</div>"
          : "")
      : "";
    const ca = t("correctAnswer") + "：";
    const answerLabel = (typeof q.answer === "number")
      ? (q.options.length
          ? (function () {
              const ot = q.options[q.answer];
              const oi = q.optionImages && q.optionImages[q.answer];
              if (oi && !ot) return ca + (q.answer + 1) + "（" + t("pasteImage") + "）";
              return ca + (q.answer + 1) + " " + ot;
            })()
          : ca + (q.answer + 1))
      : ca + q.answer;

    if (showArticle === undefined) showArticle = !!q.article;
    const articleHtml = (showArticle && q.article)
      ? '<div class="q-article"><span class="label">文章</span>' + renderRich(q.article, tokens) + "</div>"
      : "";
    const qnumLabel = (typeof q.questionNumber === "number")
      ? '<span class="qnum-label">' + q.questionNumber + ".</span> "
      : "";

    return (
      '<div class="q-card" data-id="' + escapeHtml(q.id) + '">' +
        '<div class="q-top">' +
          '<span class="badge lv" style="--lv-color:' + (LEVEL_COLOR[q.level] || "var(--primary)") + '">' + escapeHtml(q.level) + "</span>" +
          (q.problemNumber != null ? '<span class="badge prob">問題' + escapeHtml(String(q.problemNumber)) + "</span>" : "") +
          '<span class="badge cat-tag" data-cat="' + escapeHtml(q.category) + '">' + escapeHtml(labelOf("category", q.category)) + "</span>" +
          '<span class="badge src">' + escapeHtml(labelOf("source", q.source)) + escapeHtml(ymBadge(q, state.lang)) + "</span>" +
        "</div>" +
        articleHtml +
        '<div class="q-text">' + qnumLabel + renderRich(q.question, tokens) + "</div>" +
        imageHtml(q) +
        optsHtml + audioHtml +
        '<div class="q-foot">' +
          '<button class="toggle-exp" data-toggle="' + escapeHtml(q.id) + '">' +
            (expanded ? t("collapse") : t("showAnswerExp")) + "</button>" +
          (expanded ? '<span class="muted" style="font-size:12.5px">' + escapeHtml(answerLabel) + "</span>" : "") +
        "</div>" +
        expHtml +
      "</div>"
    );
  }

  function bindCardEvents(scope) {
    scope.querySelectorAll("[data-toggle]").forEach((b) => {
      b.onclick = () => {
        const id = b.getAttribute("data-toggle");
        if (state.expanded.has(id)) state.expanded.delete(id);
        else state.expanded.add(id);
        const card = b.closest(".q-card");
        const q = currentList.find((x) => x.id === id);
        if (card && q) {
          const tmp = document.createElement("div");
          tmp.innerHTML = cardHtml(q, getTokens(state.query), passageFirstIds.has(q.id));
          const newNode = tmp.firstElementChild;
          card.replaceWith(newNode);
          bindCardEvents(newNode);
        }
      };
    });
    scope.querySelectorAll("[data-tag]").forEach((t) => {
      t.onclick = () => {
        const tag = t.getAttribute("data-tag");
        $("#search").value = tag;
        state.query = tag;
        renderList();
      };
    });
  }

  function ensureSentinel(wrap) {
    let sentinel = $("#infinite-sentinel");
    if (!sentinel) {
      sentinel = document.createElement("div");
      sentinel.id = "infinite-sentinel";
      sentinel.style.height = "1px";
      wrap.appendChild(sentinel);
    }
    if (!_io) {
      _io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) appendMore();
      }, { root: null, rootMargin: "800px 0px" });
    }
    _io.disconnect();
    _io.observe(sentinel);
  }

  function appendMore() {
    if (!currentList.length || renderedCount >= currentList.length) return;
    const wrap = $("#question-list");
    const next = currentList.slice(renderedCount, renderedCount + PAGE_SIZE);
    const frag = document.createElement("div");
    frag.innerHTML = wrapWithBlockHeaders(next, renderedCount);
    const sentinel = $("#infinite-sentinel");
    if (sentinel) wrap.insertBefore(frag, sentinel);
    else wrap.appendChild(frag);
    bindCardEvents(frag);
    renderedCount += next.length;
  }

  /* ---------- 渲染：题目列表 ---------- */
  // 按「卷」(年份月份 + 等级) 分组的区块标题，避免不同年份的卷子混在一起平铺
  function blockHeaderHtml(q) {
    const ym = ymKey(q);
    const ymLabelText = ym ? ymLabel(ym, state.lang) : (q.level || "");
    return '<div class="paper-block-head"><span class="pb-level">' + escapeHtml(q.level || "") +
      '</span><span class="pb-ym">' + escapeHtml(ymLabelText) + " 真题</span>" +
      '<span class="pb-count">' + t("resultCount", { n: currentList.filter((x) => (ymKey(x) || "??") + "|" + x.level === (ymKey(q) || "??") + "|" + q.level).length }) + "</span></div>";
  }
  // 给一批卡片 HTML 包裹分组标题：当相邻题的「卷」标识变化时插入标题
  function wrapWithBlockHeaders(items, fromIdx) {
    let html = "";
    items.forEach((q, i) => {
      const key = (ymKey(q) || "??") + "|" + q.level;
      const globalIdx = fromIdx + i;
      if (key !== lastRenderedYmLevel && (globalIdx === 0 || (ymKey(currentList[globalIdx - 1]) || "??") + "|" + currentList[globalIdx - 1].level !== key)) {
        html += blockHeaderHtml(q);
        lastRenderedYmLevel = key;
      }
      html += cardHtml(q, getTokens(state.query), passageFirstIds.has(q.id));
    });
    return html;
  }

  function renderList() {
    const list = getVisible();
    const tokens = getTokens(state.query);
    const wrap = $("#question-list");
    const empty = $("#empty-state");
    let meta = t("resultCount", { n: list.length });
    if (state.query) meta += "（" + t("keyword") + "：" + escapeHtml(state.query) + "）";
    $("#result-meta").innerHTML = meta;

    if (!list.length) {
      wrap.innerHTML = "";
      empty.hidden = false;
      const picked = filtersActive();
      const et = $("#empty-title"), eh = $("#empty-hint");
      if (et) et.textContent = picked ? t("emptyTitle") : t("emptyPickTitle");
      if (eh) eh.textContent = picked ? t("emptyHint") : t("emptyPickHint");
      updateSidebarStat();
      return;
    }
    empty.hidden = true;

    currentList = list;
    // 计算篇章首题：同一 articleGroup/article 的多小题，文章只在首题显示一次
    passageFirstIds = new Set();
    let _prevKey = null;
    for (const q of list) {
      const _key = q.articleGroup != null ? q.articleGroup : (q.article != null ? q.article : null);
      if (q.article && _key && _key !== _prevKey) passageFirstIds.add(q.id);
      if (_key) _prevKey = _key;
    }
    renderedCount = Math.min(PAGE_SIZE, list.length);
    lastRenderedYmLevel = null;
    wrap.innerHTML = wrapWithBlockHeaders(list.slice(0, renderedCount), 0);
    bindCardEvents(wrap);
    ensureSentinel(wrap);
    updateSidebarStat();
  }


  function updateSidebarStat() {
    const total = state.questions.length;
    const visible = getVisible().length;
    $("#sidebar-stat").innerHTML =
      t("statTotal", { n: total }) + "<br>" + t("statMatched", { n: visible });
  }

  function renderExam() {
    const qs = state.exam.questions;
    const show = state.exam.showAnswer;
    const levels = Array.from(state.examFilters.levels);
    const cats = Array.from(state.examFilters.categories);
    const yms = Array.from(state.examFilters.yearMonths);
    $("#exam-title").textContent = t("examPaper", { n: qs.length });
    $("#exam-sub").textContent =
      t("levelLabel") + "：" + (levels.join("/") || t("all")) + " ｜ " + t("categoryLabel") + "：" + (cats.join("/") || t("all")) +
      (yms.length ? " ｜ " + t("year") + "：" + yms.map((k) => ymLabel(k, state.lang)).join(" / ") : "");

    $("#exam-paper").innerHTML = qs.map((q, i) => {
      const optsHtml = q.options.length
        ? '<div class="e-options">' + q.options.map((o, j) => {
            const correct = (typeof q.answer === "number") && j === q.answer;
            const oi = q.optionImages && q.optionImages[j];
            const inner = oi
              ? '<img class="e-opt-img" src="' + escapeHtml(oi) + '" alt="选项图片" loading="lazy" />'
              : renderRich(o, []);
            return '<div class="e-opt' + (show && correct ? " correct" : "") + '"' + (show && correct ? ' style="background:var(--primary-soft);font-weight:600"' : "") + ">" +
              '<span class="e-num">' + (j + 1) + ".</span> " + inner + (show && correct ? " ✓" : "") + "</div>";
          }).join("") + "</div>"
        : "";
      const answerText = (typeof q.answer === "number")
        ? (q.options.length
            ? (function () {
                const ot = q.options[q.answer];
                const oi = q.optionImages && q.optionImages[q.answer];
                if (oi && !ot) return (q.answer + 1) + ".（" + t("pasteImage") + "）";
                return (q.answer + 1) + ". " + ot;
              })()
            : String(q.answer + 1))
        : String(q.answer);
      const ansHtml = show
        ? '<div class="e-answer"><b>' + t("correctAnswer") + "：</b>" + escapeHtml(answerText) + "</div>" +
          (q.explanation ? '<div class="e-exp">' + renderRich(q.explanation, []) + "</div>" : "")
        : "";
      return (
        '<div class="exam-item">' +
          '<div class="e-q"><span class="num">' + (i + 1) + ".</span>" +
            "[" + escapeHtml(q.level) + "][" + escapeHtml(labelOf("category", q.category)) + "] " + renderRich(q.question, []) + "</div>" +
          imageHtml(q) +
          optsHtml + ansHtml +
        "</div>"
      );
    }).join("");
  }

  function generateExam() {
    const ef = state.examFilters;
    let pool = state.questions.filter((q) =>
      (!ef.levels.size || ef.levels.has(q.level)) &&
      (!ef.categories.size || ef.categories.has(q.category)) &&
      (!ef.yearMonths.size || ef.yearMonths.has(ymKey(q)))
    );
    if (!pool.length) { toast(t("noQuestions")); return; }
    const count = parseInt($("#exam-count").value, 10) || 10;
    // 打乱题目顺序
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, Math.min(count, pool.length));
    const shuffleOpt = $("#exam-shuffle-options") && $("#exam-shuffle-options").checked;
    const qs = picked.map((q) => {
      if (!shuffleOpt || !q.options || q.options.length < 2) return q;
      const ord = [...Array(q.options.length).keys()];
      for (let i = ord.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ord[i], ord[j]] = [ord[j], ord[i]];
      }
      const newOptions = ord.map((k) => q.options[k]);
      const newOptionImages = (q.optionImages && q.optionImages.length)
        ? ord.map((k) => q.optionImages[k])
        : q.optionImages;
      let newAnswer = q.answer;
      if (typeof q.answer === "number") newAnswer = ord.indexOf(q.answer);
      return Object.assign({}, q, { options: newOptions, optionImages: newOptionImages, answer: newAnswer });
    });
    state.exam.questions = qs;
    state.exam.showAnswer = false;
    const ta = $("#btn-toggle-answer");
    if (ta) ta.textContent = t("showAnswer");
    const res = $("#exam-result");
    if (res) res.hidden = false;
    renderExam();
  }

  /* ---------- 导入 / 导出 ---------- */
  function handleFile(file) {
    const mode = document.querySelector('input[name="import-mode"]:checked').value;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error(t("errArray"));
        const parsed = data.map(normalize);
        const invalid = parsed.filter((q) => !q.id || !q.question).length;
        if (invalid) throw new Error(t("errFields", { n: invalid }));
        if (mode === "replace") {
          state.questions = parsed;
        } else {
          const map = new Map(state.questions.map((q) => [q.id, q]));
          parsed.forEach((q) => map.set(q.id, q));
          state.questions = Array.from(map.values());
        }
        saveData();
        state.expanded.clear();
        initFilters();
        renderList();
        showImportMsg(t("importOk", { n: parsed.length, total: state.questions.length }), true);
        toast(t("importOk", { n: parsed.length, total: state.questions.length }));
        showBackupReminder(parsed.length);
      } catch (e) {
        showImportMsg(t("importFail", { msg: e.message }), false);
      }
    };
    reader.readAsText(file);
  }

  function showImportMsg(msg, ok) {
    const el = $("#import-msg");
    el.textContent = msg;
    el.className = "import-msg " + (ok ? "ok" : "err");
  }

  // 导入成功后提示用户立即备份（可关闭的横幅）
  function showBackupReminder(count) {
    const banner = $("#backup-banner");
    $("#backup-text").textContent = t("backupHint", { n: count });
    $("#backup-now").textContent = t("backupNow");
    $("#backup-dismiss").textContent = t("backupDismiss");
    banner.hidden = false;
  }

  function hideBackupReminder() {
    $("#backup-banner").hidden = true;
  }

  // 导出 JSON：优先弹出系统“保存文件”对话框（可选路径），不支持时回退到浏览器下载
  async function exportJSON(list, filename) {
    const json = JSON.stringify(list, null, 2);
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "JSON 文件", accept: { "application/json": [".json"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return true;
      } catch (e) {
        if (e && e.name === "AbortError") return false; // 用户取消
        // 其他异常（如非安全上下文）回退到下方下载方式
      }
    }
    // 回退：Blob 下载（不受支持的浏览器 / file:// 打开）
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  // 导出真题排版试卷（*.doc，Word/WPS 打开后可另存为 PDF）：纯前端、零依赖、可离线使用。
  // 排版目标：与官方 JLPT 试卷一致——顶部考试信息、大题标题（問題1 / 問題2 …，
  // 按「文字词汇 / 语法+读解 / 听解」分块重新编号）、小题连续编号、选项横向 1・2・3・4；
  // 不含答案 / 解析 / 听力原文。
  // 图片/音频以“当前页面所在目录”为基准解析为绝对 URL，本机用 Word 打开即可加载；
  // 移到其他机器时图片会失效（这是 file:// 引用的固有局限）。
  async function exportExamPaper(list, filename) {
    const base = location.href.substring(0, location.href.lastIndexOf("/") + 1);
    const absUrl = (p) => {
      if (!p) return "";
      try { return new URL(p, base).href; } catch (e) { return p; }
    };
    const fileNameOf = (p) => { const s = String(p || ""); const i = s.lastIndexOf("/"); return i >= 0 ? s.slice(i + 1) : s; };

    // ---- 推断考试信息 ----
    const levels = [...new Set(list.map((q) => q.level).filter(Boolean))];
    const level = levels[0] || "N1";
    const yms = list.map((q) => yearMonthOf(q)).filter((ym) => ym.year);
    const ym = yms[0] || {};
    const session = ym.month === 7 ? "1" : ym.month === 12 ? "2" : "";
    const yearSession = ym.year && session ? "(" + ym.year + "-" + session + ")" : "";

    const cats = new Set(list.map((q) => q.category).filter(Boolean));
    const hasVocab = cats.has("文字词汇"), hasGrammar = cats.has("语法");
    const hasReading = cats.has("读解"), hasListening = cats.has("听解");
    const lang = state.lang;
    let subject = "", score = "";
    if (hasVocab || hasGrammar || hasReading) {
      subject = lang === "ja" ? "言語知識（文字・語彙・文法）・読解"
              : lang === "en" ? "Language Knowledge (Vocabulary/Grammar) · Reading"
              : "语言知识（文字・词汇・语法）・读解";
      score = "(110分)";
    } else if (hasListening) {
      subject = lang === "ja" ? "聴解"
              : lang === "en" ? "Listening"
              : "听解";
      score = "(60分)";
    }

    // ---- 按 problemNumber / type / articleGroup 分大题（阅读题同一文章只显示一次文章） ----
    // 排序键：板块优先级 → 大题号 → 小题号 → id，保证卷面严格按官方顺序
    // （文字词汇 → 语法 → 读解 → 听解），不受源数据 id 交错存放影响。
    const CAT_PRIORITY = { "文字词汇": 0, "语法": 1, "读解": 2, "听解": 3 };
    list = list.slice().sort((a, b) => {
      const ca = CAT_PRIORITY[a.category] != null ? CAT_PRIORITY[a.category] : 9;
      const cb = CAT_PRIORITY[b.category] != null ? CAT_PRIORITY[b.category] : 9;
      if (ca !== cb) return ca - cb;
      const pa = a.problemNumber != null ? a.problemNumber : 999;
      const pb = b.problemNumber != null ? b.problemNumber : 999;
      if (pa !== pb) return pa - pb;
      const qa = a.questionNumber != null ? a.questionNumber : 0;
      const qb = b.questionNumber != null ? b.questionNumber : 0;
      if (qa !== qb) return qa - qb;
      return a.id.localeCompare(b.id);
    });
    const groups = [];
    let cur = null;
    for (const q of list) {
      const hasPassage = q.category === "读解" || !!q.article; // 读解长文与语法完形（文章の文法）均按篇章分组
      const probKey = q.problemNumber != null ? String(q.problemNumber) : (q.type || "");
      const groupKey = hasPassage
        ? probKey + "|" + (q.type || "") + "|" + (q.articleGroup || q.id)
        : probKey + "|" + (q.type || "");
      if (!cur || cur.key !== groupKey) {
        cur = {
          key: groupKey,
          problemNumber: q.problemNumber,
          type: q.type || "",
          category: q.category || "",
          articleGroup: hasPassage ? q.articleGroup : null,
          article: hasPassage ? q.article : null,
          questions: []
        };
        groups.push(cur);
      }
      cur.questions.push(q);
    }

    // ---- 组装正文 ----
    let body =
      '<div class="exam-header">' +
      '<p class="exam-session">' + escapeHtml(yearSession) + "</p>" +
      '<p class="exam-level">' + escapeHtml(level) + "</p>" +
      '<p class="exam-subject">' + escapeHtml(subject) + "</p>" +
      '<p class="exam-score">' + escapeHtml(score) + "</p>" +
      "</div>";

    let lastProb = null;
    let fallbackProb = 1;
    groups.forEach((g) => {
      const showBigTitle = g.problemNumber !== lastProb;
      if (showBigTitle) {
        const pn = g.problemNumber != null ? g.problemNumber : fallbackProb;
        const desc = g.type ? "　" + escapeHtml(g.type) : "";
        body += '<p class="big-title"><b>問題 ' + pn + desc + "</b></p>";
        lastProb = g.problemNumber;
        if (g.problemNumber == null) fallbackProb += 1;
      }
      if (g.article) {
        body += '<div class="passage">' + renderRich(g.article, []).replace(/\n/g, "<br>") + "</div>";
      }
      g.questions.forEach((q, idx) => {
        const smallNum = (typeof q.questionNumber === "number") ? q.questionNumber : (idx + 1);
        const stem = renderRich(q.question, []).replace(/\n/g, "<br>");
        body += '<div class="q-item">';
        body += '<p class="q-stem"><span class="q-num">' + smallNum + "</span> " + stem + "</p>";
        if (q.imageUrl) body += '<p class="q-img"><img src="' + absUrl(q.imageUrl) + '" style="max-width:520px;height:auto"></p>';
        if (Array.isArray(q.options) && q.options.length) {
          const cells = q.options.map((o, j) => {
            const txt = renderRich(o, []);
            const img = q.optionImages && q.optionImages[j] ? '<br><img src="' + absUrl(q.optionImages[j]) + '" style="max-width:120px;height:auto">' : "";
            return '<td class="opt-cell">' + (j + 1) + " " + txt + img + "</td>";
          }).join("");
          body += '<table class="opts-table"><tr>' + cells + "</tr></table>";
        }
        if (q.audioUrl) {
          body += '<p class="q-audio">[' + t("audioMark") + '] ' + escapeHtml(fileNameOf(q.audioUrl)) + "</p>";
        }
        body += "</div>";
      });
    });

    const title = lang === "en" ? "JLPT Exam Paper" : lang === "ja" ? "JLPT 試験問題" : "JLPT 试卷";
    const doc =
'<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
'<head><meta charset="utf-8"><title>' + escapeHtml(title) + "</title>" +
'<style>' +
" @page{size:210mm 297mm;margin-top:25mm;margin-bottom:25mm;margin-left:30mm;margin-right:30mm}" +
" body{font-family:'MS Mincho','Yu Mincho','SimSun',serif;font-size:12pt;line-height:1.35;color:#000;margin:0}" +
" .exam-header{text-align:center;margin-bottom:18pt}" +
" .exam-header p{margin:1pt 0}" +
" .exam-session{font-size:14pt}" +
" .exam-level{font-size:18pt;font-weight:bold;margin:4pt 0}" +
" .exam-subject{font-size:16pt;font-weight:bold;margin:4pt 0}" +
" .exam-score{font-size:14pt}" +
" .big-q{margin-top:14pt}" +
" .big-title{font-size:13pt;font-weight:bold;margin:6pt 0 4pt}" +
" .passage{font-size:12pt;margin:4pt 0 8pt;padding:8pt;border:1pt solid #ccc;background:#fafafa}" +
" .q-item{margin-bottom:8pt}" +
" .q-stem{font-size:12pt;margin:0 0 3pt}" +
" .q-num{display:inline-block;min-width:1.2em}" +
" .opts-table{border-collapse:collapse;width:100%;margin:2pt 0 4pt}" +
" .opts-table td{border:none;font-size:12pt;padding:1pt 10pt 1pt 0;vertical-align:top;width:25%}" +
" .q-img{margin:3pt 0}" +
" .q-img img{max-width:520px;height:auto}" +
" .q-audio{font-size:10.5pt;color:#555;margin:2pt 0}" +
" img{max-width:520px;height:auto}" +
"</style></head><body>" + body + "</body></html>";

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "Word 文档", accept: { "application/msword": [".doc"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(doc);
        await writable.close();
        return true;
      } catch (e) {
        if (e && e.name === "AbortError") return false;
      }
    }
    const blob = new Blob([doc], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  /* ---------- 粘贴导入 ---------- */
  let pastePending = [];
  let pasteImages = {}; // 原始文件名 -> base64 data URI

  // 尝试把一行解析成选项；返回选项数组或 null（不是选项行）
  function tryParseOptions(line) {
    const m = line.match(/^(\d{1,2})[\.、)）\s　]\s*([\s\S]*)$/);
    if (!m) return null;
    const rest = m[2];
    const innerCount = (rest.match(/\s+\d{1,2}[\.、)）\s　]+/g) || []).length;
    if (innerCount >= 1) {
      // 同一行多个选项：1 a 2 b 3 c 4 d
      const parts = rest.split(/\s*\d{1,2}[\.、)）\s　]+\s*/);
      const opts = parts.map((p) => p.replace(/[、)）　]+$/, "").trim()).filter(Boolean);
      return opts.length ? opts : null;
    }
    return [rest.trim()];
  }

  // 解析粘贴文本：空行分隔题目；首行为题干；后续编号行视为选项；
  // 支持「答案：N」「解析：…」标记与独立的 N1–N5 等级行
  function parsePastedQuestions(text) {
    const blocks = text.replace(/\r\n/g, "\n").split(/\n[ \t]*\n+/);
    const out = [];
    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter((l) => l.length);
      if (!lines.length) continue;
      let level = null;
      let question = null;
      const options = [];
      let answer = null;
      let explanation = "";
      let imageUrl = null;
      for (const line of lines) {
        const lvl = line.match(/^N[1-5]$/i);
        if (lvl && question === null && options.length === 0 && answer === null && !explanation && !imageUrl) {
          level = lvl[0].toUpperCase();
          continue;
        }
        const ans = line.match(/(?:答案|正解|答|answer|correct)\s*[:：]?\s*(\d{1,2})/i);
        if (ans) { answer = parseInt(ans[1], 10); continue; }
        const exp = line.match(/(?:解析|解説|说明|解释|explanation)\s*[:：]?\s*([\s\S]*)$/i);
        if (exp) { explanation = (explanation ? explanation + "\n" : "") + exp[1].trim(); continue; }
        const img = line.match(/^(?:图|图片|図|image|img|fig|figure)\s*[:：]?\s*(\S.*)$/i);
        if (img) { imageUrl = img[1].trim(); continue; }
        if (question !== null) {
          const opt = tryParseOptions(line);
          if (opt) { options.push(...opt); continue; }
        }
        if (question === null) question = line;
        else question += "\n" + line;
      }
      if (!question && !imageUrl) continue;
      out.push({ level, category: null, question: question || "", options, answer, explanation, imageUrl: imageUrl || null, optionImages: options.map(() => null) });
    }
    return out;
  }

  function isUrlLike(s) { return /^https?:\/\/|data:/i.test(s || ""); }

  function imgSelectOptions(selectedName, includeUrl) {
    const opts = ['<option value="">' + t("pasteNoImage") + "</option>"];
    Object.keys(pasteImages).forEach((name) => {
      const sel = (selectedName === name) ? " selected" : "";
      opts.push('<option value="' + escapeHtml(name) + '"' + sel + ">" + escapeHtml(name) + "</option>");
    });
    if (includeUrl && isUrlLike(selectedName)) {
      opts.push('<option value="__url__" selected>' + t("pasteImage") + " (URL)</option>");
    }
    return opts.join("");
  }

  function optImgThumbHtml(q, j) {
    const v = q.optionImages && q.optionImages[j];
    if (isUrlLike(v)) return '<img src="' + escapeHtml(v) + '" alt="" />';
    if (v && pasteImages[v]) return '<img src="' + escapeHtml(pasteImages[v]) + '" alt="" />';
    return "";
  }

  function imgThumbHtml(q) {
    if (isUrlLike(q.imageUrl)) return '<img src="' + escapeHtml(q.imageUrl) + '" alt="" />';
    if (q.imageUrl && pasteImages[q.imageUrl]) return '<img src="' + escapeHtml(pasteImages[q.imageUrl]) + '" alt="" />';
    return "";
  }

  function renderPastePreview() {
    const wrap = $("#paste-preview");
    const footer = $("#paste-footer");
    if (!pastePending.length) {
      wrap.hidden = true; footer.hidden = true;
      const msg = $("#paste-msg");
      msg.textContent = t("pasteEmpty");
      msg.className = "import-msg err";
      return;
    }
    $("#paste-msg").textContent = "";
    wrap.hidden = false; footer.hidden = false;
    const toolbar = $("#paste-img-toolbar");
    if (toolbar) toolbar.hidden = false;
    const level = $("#paste-level").value;
    const category = $("#paste-category").value;
    const source = ($("#paste-source").value || "").trim() || "未注明";
    wrap.innerHTML = "";
    pastePending.forEach((q, i) => {
      const qLevel = q.level || level;
      const card = document.createElement("div");
      card.className = "p-card";
      card.dataset.level = qLevel;
      card.dataset.category = category;
      card.dataset.source = source;
      card.dataset.idx = i;
      const optHtml = q.options.map((o, j) =>
        '<div class="p-opt-row">' +
          '<span class="p-num">' + (j + 1) + '</span>' +
          '<input class="p-opt" type="text" value="' + escapeHtml(o) + '" placeholder="' + t("pasteOptImage") + '" />' +
          '<select class="p-opt-img" title="' + t("pasteOptImageHint") + '">' + imgSelectOptions((q.optionImages && q.optionImages[j]) || "", false) + '</select>' +
          '<span class="p-opt-thumb">' + optImgThumbHtml(q, j) + '</span>' +
        '</div>'
      ).join("");
      const ansOptions = ['<option value="">' + t("pasteNoAnswer") + "</option>"]
        .concat(q.options.map((_, j) =>
          '<option value="' + (j + 1) + '"' + ((q.answer === j + 1) ? " selected" : "") + ">" + (j + 1) + "</option>"))
        .join("");
      card.innerHTML =
        '<div class="p-card-head">' +
          '<label class="check-row p-inc-wrap"><input type="checkbox" class="p-inc" checked /> <span>' + (i + 1) + "</span></label>" +
          '<span class="badge lv" style="--lv-color:' + (LEVEL_COLOR[qLevel] || "var(--primary)") + '">' + escapeHtml(qLevel) + "</span>" +
          '<span class="badge cat">' + escapeHtml(category) + "</span>" +
          '<button class="link-btn p-del" type="button" title="' + t("pasteDelete") + '">✕</button>' +
        "</div>" +
        '<textarea class="p-q" rows="2" placeholder="' + t("pasteQuestion") + '">' + escapeHtml(q.question) + "</textarea>" +
        '<div class="p-img-row">' +
          '<label class="p-img-label"><span>' + t("pasteQImage") + '</span>' +
          '<select class="p-img">' + imgSelectOptions(q.imageUrl, true) + "</select></label>" +
          '<div class="p-img-thumb">' + imgThumbHtml(q) + "</div>" +
        "</div>" +
        '<div class="p-opts">' + optHtml + "</div>" +
        '<div class="p-foot-row">' +
          '<label class="p-ans-wrap"><span>' + t("pasteAnswer") + '</span><select class="p-ans">' + ansOptions + "</select></label>" +
          '<textarea class="p-exp" rows="2" placeholder="' + t("pasteExplanation") + '">' + escapeHtml(q.explanation) + "</textarea>" +
        "</div>";
      wrap.appendChild(card);
    });
    updatePasteCount();
  }

  function updatePasteCount() {
    const total = pastePending.length;
    const sel = $("#paste-preview").querySelectorAll(".p-inc:checked").length;
    $("#paste-count").textContent = t("pastePreview", { n: total }) + " ｜ " + t("pasteSelected", { n: sel });
  }

  function savePaste() {
    const cards = $("#paste-preview").querySelectorAll(".p-card");
    const list = [];
    const stamp = Date.now();
    cards.forEach((card) => {
      if (!card.querySelector(".p-inc").checked) return;
      const idx = parseInt(card.dataset.idx, 10);
      const question = card.querySelector(".p-q").value.trim();
      const imgSel = card.querySelector(".p-img").value;
      let imageUrl = null;
      if (imgSel === "__url__") imageUrl = (pastePending[idx] && pastePending[idx].imageUrl) || null;
      else if (imgSel) imageUrl = pasteImages[imgSel] || null;
      // 选项（文字 + 图片）逐行收集；去掉既无文字也无图的空行，答案同步重映射
      const rows = card.querySelectorAll(".p-opt-row");
      const options = [];
      const optionImages = [];
      const keptOldIndex = [];
      rows.forEach((row, j) => {
        const txt = row.querySelector(".p-opt").value.trim();
        const oSel = row.querySelector(".p-opt-img").value;
        const img = oSel === "__url__" ? (pastePending[idx] && pastePending[idx].optionImages && pastePending[idx].optionImages[j]) : (oSel ? pasteImages[oSel] : null);
        if (!txt && !img) return;
        options.push(txt);
        optionImages.push(img);
        keptOldIndex.push(j);
      });
      if (!question && !imageUrl) return; // 既无题干也无题图则跳过
      let answer = "";
      const ansVal = card.querySelector(".p-ans").value;
      if (ansVal) {
        const oldIdx = parseInt(ansVal, 10) - 1;
        const newIdx = keptOldIndex.indexOf(oldIdx);
        answer = newIdx === -1 ? "" : newIdx;
      }
      const explanation = card.querySelector(".p-exp").value.trim();
      list.push({
        id: "paste-" + stamp + "-" + idx,
        level: card.dataset.level,
        category: card.dataset.category,
        source: card.dataset.source,
        question: question,
        options: options,
        optionImages: optionImages,
        answer: answer,
        explanation: explanation,
        imageUrl: imageUrl,
        tags: ["粘贴导入"],
        year: null
      });
    });
    if (!list.length) { toast(t("pasteEmpty")); return; }
    window.JlptApp.addQuestions(list);
    toast(t("pasteSaved", { n: list.length }));
    $("#paste-modal").hidden = true;
  }

  function renderImgList() {
    const list = $("#paste-img-list");
    const names = Object.keys(pasteImages);
    list.innerHTML = names.map((name) =>
      '<div class="img-chip"><img src="' + escapeHtml(pasteImages[name]) + '" alt="" />' +
      '<span class="img-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) + "</span>" +
      '<button class="img-x" type="button" data-name="' + escapeHtml(name) + '" title="' + t("pasteImgRemove") + '">✕</button></div>'
    ).join("");
  }

  function attachImages(files) {
    Array.from(files).forEach((file) => {
      if (!/^image\//.test(file.type)) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base = file.name;
        let name = base, n = 1;
        while (pasteImages[name]) { name = base.replace(/(\.[^.]+)?$/, "_" + n + "$1"); n++; }
        pasteImages[name] = reader.result;
        renderImgList();
        refreshImgSelects();
      };
      reader.readAsDataURL(file);
    });
  }

  function refreshImgSelects() {
    $("#paste-preview").querySelectorAll(".p-card").forEach((card) => {
      const idx = parseInt(card.dataset.idx, 10);
      const q = pastePending[idx];
      const sel = card.querySelector(".p-img");
      if (sel) {
        const cur = sel.value;
        sel.innerHTML = imgSelectOptions(q.imageUrl || cur, true);
        if (cur && Array.from(sel.options).some((o) => o.value === cur)) sel.value = cur;
        else if (cur === "__url__") sel.value = "__url__";
      }
      const thumb = card.querySelector(".p-img-thumb");
      if (thumb) thumb.innerHTML = imgThumbHtml(q);
      card.querySelectorAll(".p-opt-row").forEach((row, j) => {
        const osel = row.querySelector(".p-opt-img");
        if (osel) {
          const cur = osel.value;
          osel.innerHTML = imgSelectOptions((q.optionImages && q.optionImages[j]) || cur, false);
          if (cur && Array.from(osel.options).some((o) => o.value === cur)) osel.value = cur;
        }
        const othumb = row.querySelector(".p-opt-thumb");
        if (othumb) othumb.innerHTML = optImgThumbHtml(q, j);
      });
    });
  }

  // 按附件顺序自动填充：先填空题干图，再填空选项图
  function autoFillImages() {
    const cards = $("#paste-preview").querySelectorAll(".p-card");
    const names = Object.keys(pasteImages);
    const used = new Set();
    let cursor = 0;
    const nextUnused = () => {
      while (cursor < names.length && used.has(names[cursor])) cursor++;
      return cursor < names.length ? names[cursor] : null;
    };
    cards.forEach((card) => {
      const idx = parseInt(card.dataset.idx, 10);
      const q = pastePending[idx];
      const qHasText = card.querySelector(".p-q").value.trim().length > 0;
      const imgSel = card.querySelector(".p-img");
      if (!qHasText && imgSel && imgSel.value === "") {
        const name = nextUnused();
        if (name) { imgSel.value = name; used.add(name); q.imageUrl = name; }
      }
      card.querySelectorAll(".p-opt-row").forEach((row) => {
        const optSel = row.querySelector(".p-opt-img");
        const optText = row.querySelector(".p-opt").value.trim();
        if (optSel && optText.length === 0 && optSel.value === "") {
          const name = nextUnused();
          if (name) {
            optSel.value = name; used.add(name);
            const j = Array.prototype.indexOf.call(card.querySelectorAll(".p-opt-row"), row);
            if (!q.optionImages) q.optionImages = q.options.map(() => null);
            q.optionImages[j] = name;
            const thumb = row.querySelector(".p-opt-thumb");
            if (thumb) thumb.innerHTML = optImgThumbHtml(q, j);
          }
        }
      });
      const thumb = card.querySelector(".p-img-thumb");
      if (thumb) thumb.innerHTML = imgThumbHtml(q);
    });
    toast(t("pasteAutoImg"));
  }

  /* ---------- 主题 ---------- */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    $(".theme-icon").textContent = state.theme === "dark" ? "☀️" : "🌙";
  }
  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
    try { localStorage.setItem(LS_KEY + "-theme", state.theme); } catch (e) {}
  }

  /* ---------- 视图切换 ---------- */
  function switchView(view) {
    state.view = view;
    $("#view-browse").hidden = view !== "browse";
    $("#view-exam").hidden = view !== "exam";
    $("#btn-exam").textContent = view === "exam" ? t("backToBrowse") : t("exam");
    if (view === "browse") renderList();
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    // 搜索
    $("#search").addEventListener("input", (e) => {
      state.query = e.target.value;
      renderList();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== $("#search") &&
          !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        e.preventDefault();
        $("#search").focus();
      }
    });

    // 主题
    $("#btn-theme").addEventListener("click", toggleTheme);

    // 语言切换
    const langMenu = $("#lang-menu");
    $("#btn-lang").addEventListener("click", (e) => { e.stopPropagation(); langMenu.hidden = !langMenu.hidden; });
    langMenu.querySelectorAll("[data-lang]").forEach((b) => {
      b.addEventListener("click", () => { setLang(b.getAttribute("data-lang")); langMenu.hidden = true; });
    });
    document.addEventListener("click", (e) => {
      if (!langMenu.hidden && !langMenu.contains(e.target) && e.target !== $("#btn-lang")) langMenu.hidden = true;
    });

    // 组卷切换
    $("#btn-exam").addEventListener("click", () => switchView(state.view === "exam" ? "browse" : "exam"));

    // 排序
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderList(); });

    // 听解音频筛选
    $("#filter-audio").addEventListener("change", (e) => { state.filters.audioOnly = e.target.checked; renderList(); });

    // 重置筛选
    $("#btn-reset").addEventListener("click", () => {
      state.filters.levels = new Set(uniqueValues("level"));
      state.filters.categories = new Set(uniqueValues("category"));
      state.filters.audioOnly = false;
      $("#filter-audio").checked = false;
      $("#search").value = ""; state.query = "";
      initFilters();
      renderList();
    });

    // 全选 / 全不选
    document.querySelectorAll("[data-toggle-all]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const group = btn.getAttribute("data-toggle-all");
        // 判断按钮属于浏览筛选区还是组卷区
        const which = btn.closest("#view-exam") ? "exam" : "filter";
        const f = (which === "exam") ? state.examFilters : state.filters;
        const setName = GROUP_SET[group];
        const set = f[setName];
        if (!set) return;
        // 年份（考次）的全选集合须按「当前已选等级」计算，不能列出无题的年份
        const all = (group === "yearMonth")
          ? yearMonthsForLevels(f.levels)
          : uniqueValues(group);
        const allSelected = all.length > 0 && all.every((v) => set.has(v));
        set.clear();
        if (!allSelected) all.forEach((v) => set.add(v));
        if (group === "yearMonth") renderYearChips(which);
        else renderChips((which === "exam" ? "exam-" : "filter-") + group, all, set, group, which);
        if (which === "filter" && state.view === "browse") renderList();
        updateSidebarStat();
      });
    });

    // 导出（Word 文档）
    $("#btn-export").addEventListener("click", async () => {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const list = getExportList();
      if (!list.length) { toast(t("emptyList")); return; }
      const ok = await exportExamPaper(list, "jlpt-试卷-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + ".doc");
      if (ok) { toast(t("exported", { n: list.length })); hideBackupReminder(); }
    });

    // 备份提醒横幅
    $("#backup-now").addEventListener("click", async () => {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const ok = await exportJSON(state.questions, "jlpt-题库-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + ".json");
      if (ok) { toast(t("exported", { n: state.questions.length })); hideBackupReminder(); }
    });
    $("#backup-dismiss").addEventListener("click", hideBackupReminder);

    // 导入弹窗
    const modal = $("#import-modal");
    $("#btn-import").addEventListener("click", () => { showImportMsg("", false); modal.hidden = false; });
    $("#btn-modal-close").addEventListener("click", () => (modal.hidden = true));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
    const fi = $("#file-input");
    $("#dropzone").addEventListener("click", () => fi.click());
    fi.addEventListener("change", (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });
    const dz = $("#dropzone");
    ["dragover", "dragenter"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
    dz.addEventListener("drop", (e) => {
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    });

    // 粘贴导入
    const pasteModal = $("#paste-modal");
    $("#btn-paste").addEventListener("click", () => {
      pastePending = [];
      pasteImages = {};
      $("#paste-text").value = "";
      $("#paste-preview").hidden = true;
      $("#paste-footer").hidden = true;
      $("#paste-msg").textContent = "";
      renderImgList();
      pasteModal.hidden = false;
    });
    $("#btn-paste-close").addEventListener("click", () => (pasteModal.hidden = true));
    pasteModal.addEventListener("click", (e) => { if (e.target === pasteModal) pasteModal.hidden = true; });
    $("#btn-paste-parse").addEventListener("click", () => {
      pastePending = parsePastedQuestions($("#paste-text").value);
      renderPastePreview();
    });
    $("#btn-paste-clear").addEventListener("click", () => {
      $("#paste-text").value = "";
      pastePending = [];
      $("#paste-preview").hidden = true;
      $("#paste-footer").hidden = true;
      $("#paste-msg").textContent = "";
    });
    $("#btn-paste-save").addEventListener("click", savePaste);
    $("#paste-preview").addEventListener("change", (e) => {
      if (e.target.classList.contains("p-inc")) { updatePasteCount(); return; }
      if (e.target.classList.contains("p-img")) {
        const card = e.target.closest(".p-card");
        const idx = parseInt(card.dataset.idx, 10);
        const q = pastePending[idx];
        q.imageUrl = e.target.value === "__url__" ? (q.imageUrl || "") : e.target.value;
        const thumb = card.querySelector(".p-img-thumb");
        if (thumb) thumb.innerHTML = imgThumbHtml(q);
      } else if (e.target.classList.contains("p-opt-img")) {
        const row = e.target.closest(".p-opt-row");
        const card = e.target.closest(".p-card");
        const idx = parseInt(card.dataset.idx, 10);
        const q = pastePending[idx];
        if (!q.optionImages) q.optionImages = q.options.map(() => null);
        const j = Array.prototype.indexOf.call(card.querySelectorAll(".p-opt-row"), row);
        q.optionImages[j] = e.target.value === "__url__" ? (q.optionImages[j] || null) : e.target.value;
        const thumb = row.querySelector(".p-opt-thumb");
        if (thumb) thumb.innerHTML = optImgThumbHtml(q, j);
      }
    });
    $("#btn-auto-img").addEventListener("click", autoFillImages);
    $("#paste-preview").addEventListener("click", (e) => {
      const del = e.target.closest(".p-del");
      if (del) {
        const card = del.closest(".p-card");
        const idx = parseInt(card.dataset.idx, 10);
        if (!isNaN(idx)) pastePending.splice(idx, 1);
        renderPastePreview();
      }
    });

    // 粘贴弹窗：图片附件
    const imgInput = $("#paste-img-input");
    const imgDrop = $("#paste-img-drop");
    imgDrop.addEventListener("click", () => imgInput.click());
    imgInput.addEventListener("change", (e) => { if (e.target.files.length) attachImages(e.target.files); e.target.value = ""; });
    ["dragover", "dragenter"].forEach((ev) => imgDrop.addEventListener(ev, (e) => { e.preventDefault(); imgDrop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => imgDrop.addEventListener(ev, (e) => { e.preventDefault(); imgDrop.classList.remove("drag"); }));
    imgDrop.addEventListener("drop", (e) => { const f = e.dataTransfer.files; if (f && f.length) attachImages(f); });
    $("#paste-img-list").addEventListener("click", (e) => {
      const x = e.target.closest(".img-x");
      if (x) { const name = x.dataset.name; delete pasteImages[name]; renderImgList(); refreshImgSelects(); }
    });

    // 组卷
    $("#exam-count").addEventListener("input", (e) => ($("#exam-count-val").textContent = e.target.value));
    $("#btn-generate").addEventListener("click", generateExam);
    $("#btn-regen").addEventListener("click", generateExam);
    $("#btn-toggle-answer").addEventListener("click", () => {
      state.exam.showAnswer = !state.exam.showAnswer;
      $("#btn-toggle-answer").textContent = state.exam.showAnswer ? t("hideAnswer") : t("showAnswer");
      renderExam();
    });
    $("#btn-print").addEventListener("click", () => window.print());
    $("#btn-export-exam").addEventListener("click", async () => {
      if (!state.exam.questions.length) { toast(t("genFirst")); return; }
      const ok = await exportJSON(state.exam.questions, "jlpt-试卷-" + state.exam.questions.length + "题.json");
      if (ok) toast(t("examExported"));
    });
  }

  /* ---------- 启动 ---------- */
  async function init() {
    await loadData();
    applyTheme();
    initFilters();
    // 初始不预选任何条件 —— 打开即空白、零渲染，避免一次性载入海量卡片导致卡顿。
    // 用户需主动选择等级 / 分类 / 年份（或点「全选」）才出题。
    // 年份依赖等级：初始等级为空 → 年份区显示占位提示，不渲染年份按钮。
    const lv = uniqueValues("level"), cat = uniqueValues("category");
    state.filters.levels = new Set();
    state.filters.categories = new Set();
    state.filters.yearMonths = new Set();
    state.filters.audioOnly = false;
    renderChips("filter-level", lv, state.filters.levels, "level");
    renderChips("filter-category", cat, state.filters.categories, "category");
    renderYearChips("filter");
    bindEvents();
    applyLang();
  }

  document.addEventListener("DOMContentLoaded", init);

  // 供导入模块（粘贴导入等）调用
  window.JlptApp = {
    t: t,
    getLang: () => state.lang,
    toast: toast,
    addQuestions: (list) => {
      const norm = list.map(normalize);
      const map = new Map(state.questions.map((q) => [q.id, q]));
      norm.forEach((q) => map.set(q.id, q));
      state.questions = Array.from(map.values());
      saveData();
      state.expanded.clear();
      initFilters();
      renderList();
      showBackupReminder(norm.length);
    }
  };
})();
