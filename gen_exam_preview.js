#!/usr/bin/env node
// 把 mojidict 备份 JSON 渲染成可读试卷 HTML
// 用法: node gen_exam_preview.js <备份json绝对路径> [输出html绝对路径]
const fs = require("fs");
const path = require("path");

const SRC = process.argv[2];
const OUT = process.argv[3] || path.join(path.dirname(SRC), "exam_preview.html");
if (!SRC) { console.error("用法: node gen_exam_preview.js <备份json> [输出html]"); process.exit(1); }

const data = JSON.parse(fs.readFileSync(SRC, "utf8"));
const exam = data.exam || {};
const sections = data.sections || [];

const CAT_LABEL = { "文字词汇": "文字・語彙", "语法": "文法", "读解": "読解", "听解": "聴解" };

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 渲染题干：保留 <u> 高亮、★ 标记、把连续下划线变成填空框
function renderStem(title) {
  let t = esc(title || "");
  // 还原 <u> 高亮（esc 后变成 &lt;u&gt;）
  t = t.replace(/&lt;u&gt;/g, '<u class="hl">').replace(/&lt;\/u&gt;/g, "</u>");
  // ★ 标记
  t = t.replace(/★/g, '<span class="star">★</span>');
  // 连续下划线（半角_ / 全角＿）变为填空框
  t = t.replace(/[＿_]+/g, '<span class="blank"></span>');
  return t;
}

function optLabel(i) { return String.fromCharCode(65 + i); } // 0->A

function renderQuestion(q, section) {
  const isSort = (q.title || "").includes("★");
  const qnum = q.questionNumber != null ? q.questionNumber : q.problemNumber;
  const qlabel = section.category === "听解"
    ? (q.problemNumber != null ? q.problemNumber + "番" : "問" + qnum)
    : "問" + qnum;

  let html = '<div class="q">';
  html += '<div class="q-head"><span class="q-no">' + esc(qlabel) + '</span></div>';

  // 题干（文字/语法/排序）
  if (q.title && q.title.trim()) {
    html += '<div class="stem">' + renderStem(q.title) + '</div>';
  }

  // 图片（部分读解题）
  if (q.imageFile) {
    html += '<div class="q-img"><img src="' + esc(q.imageFile) + '" alt="問題図" /></div>';
  }

  // 选项
  const opts = q.options || [];
  html += '<ol class="opts">';
  opts.forEach((o, i) => {
    html += '<li data-i="' + i + '"><span class="opt-key">' + optLabel(i) + '</span><span class="opt-txt">' + esc(o) + '</span></li>';
  });
  html += '</ol>';

  // 听力：文稿（日文时间轴 + 中文翻译）
  if (section.category === "听解") {
    const tr = q.transcript || [];
    const tl = q.translation || [];
    if (tr.length || tl.length) {
      html += '<div class="script">';
      html += '<div class="script-title">📝 音声スクリプト（日文 / 中文）</div>';
      const n = Math.max(tr.length, tl.length);
      for (let i = 0; i < n; i++) {
        const t = tr[i] || {};
        const ts = t.start ? '<span class="ts">' + esc(t.start) + '</span> ' : '';
        html += '<div class="line"><div class="jp">' + ts + esc(t.text || "") + '</div>';
        if (tl[i]) html += '<div class="cn">' + esc(tl[i]) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }
    if (q.audioFile) {
      html += '<div class="audio"><audio controls preload="none" src="' + esc(q.audioFile) + '">你的浏览器不支持音频</audio></div>';
    }
  }

  // 答案 + 解析（默认隐藏，点"显示答案"展开）
  const ai = (q.answerIndex != null) ? q.answerIndex : -1;
  html += '<div class="ans">';
  if (!isSort && ai >= 0 && ai < opts.length) {
    html += '<div class="correct">正解：<b>' + optLabel(ai) + '</b>　' + esc(opts[ai]) + '</div>';
  } else if (q.answerText) {
    html += '<div class="correct">正解：<b>' + esc(q.answerText) + '</b></div>';
  }
  if (q.analysis) {
    html += '<div class="analysis">' + esc(q.analysis).replace(/\n/g, "<br/>") + '</div>';
  }
  html += '</div>';

  html += '</div>';
  return html;
}

let body = "";
sections.forEach((s) => {
  const cat = CAT_LABEL[s.category] || s.category;
  body += '<section class="sec">';
  body += '<div class="sec-head"><span class="sec-no">問題' + s.index + '</span>'
        + '<span class="sec-cat">' + esc(cat) + '</span>'
        + '<span class="sec-title">' + esc(s.sectionTitle) + '</span>'
        + '<span class="sec-count">(' + s.questions.length + '問)</span></div>';

  // 阅读：文章只在最前显示一次
  const firstArt = s.questions.find((q) => q.article);
  if (firstArt && firstArt.article) {
    const paras = String(firstArt.article).split(/\n+/).filter(Boolean);
    body += '<div class="article">' + paras.map((p) => '<p>' + esc(p) + '</p>').join("") + '</div>';
  }

  s.questions.forEach((q) => { body += renderQuestion(q, s); });
  body += '</section>';
});

const titleText = (exam.title ? exam.title + " " : "") + (exam.tag || "");
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JLPT 试卷预览 - ${esc(titleText)}</title>
<style>
  :root{ --ink:#1f2430; --soft:#5b6472; --line:#e4e8ef; --pri:#2f6df0; --pri-soft:#eaf1ff; --ok:#1f9d55; --bg:#f5f7fb; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Sans","Yu Gothic",-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;line-height:1.7;font-size:15px}
  .topbar{position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid var(--line);padding:12px 20px;display:flex;align-items:center;gap:14px;box-shadow:0 2px 10px rgba(0,0,0,.04)}
  .topbar h1{font-size:17px;margin:0}
  .topbar .meta{color:var(--soft);font-size:13px}
  .toggle{margin-left:auto;cursor:pointer;border:1px solid var(--pri);color:var(--pri);background:#fff;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600}
  .toggle:hover{background:var(--pri-soft)}
  .wrap{max-width:820px;margin:22px auto;padding:0 16px 80px}
  .sec{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.03)}
  .sec-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;border-bottom:2px solid var(--line);padding-bottom:10px;margin-bottom:14px}
  .sec-no{font-weight:800;color:var(--pri)}
  .sec-cat{font-size:12px;background:var(--pri-soft);color:var(--pri);padding:2px 9px;border-radius:999px;font-weight:700}
  .sec-title{color:var(--ink);font-weight:600;flex:1;min-width:200px}
  .sec-count{color:var(--soft);font-size:12px}
  .article{background:#fbfcfe;border:1px dashed var(--line);border-radius:10px;padding:14px 16px;margin-bottom:16px;color:#33404f;font-size:14.5px}
  .article p{margin:0 0 10px}.article p:last-child{margin-bottom:0}
  .q{padding:12px 0;border-top:1px solid #f0f2f6}
  .q:first-of-type{border-top:none}
  .q-head{margin-bottom:6px}
  .q-no{display:inline-block;font-weight:800;color:var(--pri);background:var(--pri-soft);border-radius:6px;padding:1px 9px;font-size:13px}
  .stem{font-size:16px;margin:4px 0 10px;font-weight:500}
  u.hl{text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--pri);color:var(--pri);font-weight:700}
  .star{color:#e0532a;font-weight:800;font-size:18px;margin:0 2px}
  .blank{display:inline-block;width:34px;height:1.1em;border-bottom:2px solid var(--ink);vertical-align:middle;margin:0 3px}
  .opts{list-style:none;margin:8px 0 0;padding:0}
  .opts li{display:flex;gap:10px;padding:7px 10px;border-radius:8px;margin-bottom:5px;background:#fafbfd;border:1px solid #eef1f6}
  .opt-key{font-weight:800;color:var(--pri);min-width:20px}
  .opt-txt{flex:1}
  .q-img{margin:8px 0}.q-img img{max-width:100%;border:1px solid var(--line);border-radius:8px}
  .audio{margin:10px 0}.audio audio{width:100%}
  .script{background:#f7f9fc;border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:10px 0;font-size:14px}
  .script-title{font-weight:700;color:var(--soft);font-size:12.5px;margin-bottom:8px}
  .line{margin-bottom:8px}.line:last-child{margin-bottom:0}
  .jp{color:#222}.ts{color:var(--soft);font-size:12px;font-variant-numeric:tabular-nums}
  .cn{color:#3a6;margin-top:2px;padding-left:2px}
  .ans{display:none;margin-top:10px;padding:10px 12px;background:#f3fbf6;border:1px solid #cdeedd;border-radius:8px}
  body.show .ans{display:block}
  .correct{font-weight:700;color:var(--ok);margin-bottom:4px}
  .analysis{color:#37424f;font-size:13.5px;white-space:normal}
  body.show .opts li.correct-li{outline:2px solid var(--ok);background:#eafaf0}
</style>
</head>
<body>
  <div class="topbar">
    <h1>JLPT 试卷预览 · ${esc(titleText)}</h1>
    <span class="meta">${esc((exam.sectionCount||sections.length) + " 大题 / " + (exam.questionCount||"") + " 题")}</span>
    <button class="toggle" id="tg">显示答案 / 解析</button>
  </div>
  <div class="wrap">${body}</div>
  <script>
    // 全局答案开关
    var tg=document.getElementById('tg');
    tg.addEventListener('click',function(){
      var on=document.body.classList.toggle('show');
      tg.textContent=on?'隐藏答案 / 解析':'显示答案 / 解析';
      // 标记正确选项
      document.querySelectorAll('.opts li').forEach(function(li){
        li.classList.remove('correct-li');
      });
      if(on){
        document.querySelectorAll('.sec').forEach(function(sec){
          sec.querySelectorAll('.q').forEach(function(q){
            var c=q.querySelector('.correct b');
            if(c){
              var ch=c.textContent.trim();
              q.querySelectorAll('.opts li').forEach(function(li){
                if(li.querySelector('.opt-key').textContent.trim()===ch) li.classList.add('correct-li');
              });
            }
          });
        });
      }
    });
  </script>
</body>
</html>`;

fs.writeFileSync(OUT, html, "utf8");
console.log("已生成:", OUT, "| 大小(KB):", (fs.statSync(OUT).size/1024).toFixed(1));
