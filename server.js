// JLPT 个人题库 —— 本地服务器
// 作用：1) 提供静态文件访问；2) 让题库自动落盘为 data/questions.json
// 用法：node server.js  （默认端口 8080，可用 PORT=9000 node server.js 修改）
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(ROOT, "data");
const BANK_FILE = path.join(DATA_DIR, "questions.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  // 解析请求路径：兼容浏览器对非 ASCII（中文）路径直接发原始 UTF-8 的情况，
  // new URL 在遇到非百分号编码的中文时会抛 URIError，故先做安全解码。
  let pathname;
  try {
    pathname = new URL(req.url, "http://localhost").pathname;
  } catch (e) {
    pathname = req.url.split("?")[0];
  }
  try {
    pathname = decodeURIComponent(pathname);
  } catch (e) { /* 已解码或无需解码 */ }

  // ---- API: 读取文件题库 ----
  if (pathname === "/api/load" && req.method === "GET") {
    fs.readFile(BANK_FILE, "utf8", (err, data) => {
      if (err) return send(res, 404, JSON.stringify({ error: "no file" }), "application/json");
      send(res, 200, data, "application/json");
    });
    return;
  }

  // ---- API: 保存文件题库 ----
  if (pathname === "/api/save" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      let text = Buffer.concat(chunks).toString("utf8");
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error("内容必须是题目数组");
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(BANK_FILE, JSON.stringify(parsed, null, 2), "utf8");
        console.log("[save] 已写入 data/questions.json，共 " + parsed.length + " 题");
        send(res, 200, JSON.stringify({ ok: true, count: parsed.length }), "application/json");
      } catch (e) {
        send(res, 400, JSON.stringify({ ok: false, error: e.message }), "application/json");
      }
    });
    return;
  }

  // ---- 静态文件 ----
  let p = pathname;
  if (p === "/") p = "/index.html";
  const filePath = path.normalize(path.join(ROOT, p));
  if (!filePath.startsWith(ROOT)) return send(res, 403, "Forbidden");
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not Found");
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || "application/octet-stream");
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("JLPT 个人题库已启动：http://127.0.0.1:" + PORT + "/");
  console.log("题库文件将自动保存到：" + BANK_FILE);
});
