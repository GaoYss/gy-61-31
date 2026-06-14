const http = require("http");
const https = require("https");
const path = require("path");
const fs = require("fs");
const os = require("os");
const {
  banner,
  step,
  success,
  warn,
  error,
  info,
  log,
  COLORS,
  pythonBin,
  BACKEND_DIR,
  runSync,
} = require("./_utils");

const BACKEND_HEALTH = "http://127.0.0.1:8000/api/health/";
const BACKEND_STATS = "http://127.0.0.1:8000/api/stats/";
const FRONTEND_URL = "http://127.0.0.1:5173/";
const BACKEND_API = "http://127.0.0.1:8000/api/";

function request(url, options = {}) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const start = Date.now();
    const req = lib.get(url, { timeout: 5000, ...options }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 500,
          status: res.statusCode,
          latencyMs: Date.now() - start,
          body: data,
          headers: res.headers,
        });
      });
    });
    req.on("error", (e) => {
      resolve({ ok: false, status: 0, latencyMs: Date.now() - start, error: e.message, body: "" });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, latencyMs: Date.now() - start, error: "timeout", body: "" });
    });
  });
}

function fmt(v) {
  if (v === true) return `${COLORS.green}OK${COLORS.reset}`;
  if (v === false) return `${COLORS.red}FAIL${COLORS.reset}`;
  return String(v);
}

function row(name, value, indent = 0) {
  const pad = " ".repeat(indent);
  log(`${pad}${name.padEnd(28 - indent)} ${value}`);
}

async function main() {
  const full = process.argv.includes("--full") || process.argv.includes("-a");
  const demo = process.argv.includes("--data") || process.argv.includes("-d");
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");

  banner("系统健康检查");
  log("");
  const results = [];

  // ── 1. 后端健康端点 ──
  step("1/6  后端健康端点 (api/health)");
  const h = await request(BACKEND_HEALTH);
  let hData = null;
  try { hData = h.body ? JSON.parse(h.body) : null; } catch {}
  const hOk = h.ok && hData?.status === "healthy";
  row("HTTP 状态", `${h.status || "连接失败"}  ${h.latencyMs}ms`);
  if (hData) {
    row("整体状态", fmt(hData.status === "healthy"));
    row("版本", hData.version || "-");
    row("时间戳", hData.timestamp || "-");
    for (const [k, v] of Object.entries(hData?.checks || {})) {
      row(`  检查项 [${k}]`, fmt(v.status === "healthy"));
      if (v.error && verbose) row("    错误", v.error);
    }
  }
  if (hOk) success("后端健康检查通过");
  else { error("后端健康检查失败"); if (h.error) info(`原因: ${h.error}`); }
  results.push({ name: "后端健康", ok: hOk });

  // ── 2. 后端 API ──
  step("2/6  后端 API 入口 (api/)");
  const a = await request(BACKEND_API);
  row("HTTP 状态", `${a.status || "连接失败"}  ${a.latencyMs}ms`);
  if (a.ok) success("API 入口可达");
  else error("API 入口不可达");
  results.push({ name: "后端 API 入口", ok: a.ok });

  // ── 3. 前端服务 ──
  step("3/6  前端开发服务器 (5173)");
  const f = await request(FRONTEND_URL);
  row("HTTP 状态", `${f.status || "连接失败"}  ${f.latencyMs}ms`);
  const hasHtml = f.body && f.body.includes("<html");
  row("HTML 响应", fmt(!!hasHtml));
  if (f.ok && hasHtml) {
    success("前端服务正常");
    results.push({ name: "前端服务", ok: true });
  } else {
    warn("前端服务可能未启动（如只启动了后端可忽略）");
    results.push({ name: "前端服务", ok: null });
  }

  // ── 4. Stats 接口 ──
  step("4/6  统计接口 (api/stats)");
  const s = await request(BACKEND_STATS);
  let sData = null;
  try { sData = s.body ? JSON.parse(s.body) : null; } catch {}
  row("HTTP 状态", `${s.status || "连接失败"}  ${s.latencyMs}ms`);
  if (sData) {
    for (const [k, v] of Object.entries(sData)) {
      const val = Array.isArray(v) ? `${v.length} 项` : String(v);
      row(`  ${k}`, val);
    }
  }
  if (s.ok && sData) success("统计接口正常");
  else error("统计接口异常");
  results.push({ name: "统计接口", ok: !!(s.ok && sData) });

  // ── 5. 数据完整性 ──
  if (demo || full) {
    step("5/6  演示数据完整性（通过 Django ORM 验证）");
    const tmpPy = path.join(os.tmpdir(), `_hc_counts_${Date.now()}.py`);
    fs.writeFileSync(
      tmpPy,
      [
        "import django, os, sys",
        `sys.path.insert(0, ${JSON.stringify(BACKEND_DIR)})`,
        "os.chdir(sys.path[0])",
        "os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')",
        "django.setup()",
        "from access.models import AccessDevice, AlarmEvent, DoorOpenLog, VisitorPass",
        "print('DEVICES', AccessDevice.objects.count())",
        "print('VISITORS', VisitorPass.objects.count())",
        "print('ALARMS', AlarmEvent.objects.count())",
        "print('LOGS', DoorOpenLog.objects.count())",
      ].join("\n"),
      "utf-8"
    );
    let text = "";
    try {
      const r = runSync(pythonBin(), [tmpPy], BACKEND_DIR);
      const parts = [];
      if (r.stdout) parts.push(r.stdout.toString());
      if (r.stderr) parts.push(r.stderr.toString());
      for (const buf of r.output || []) { if (buf) parts.push(buf.toString()); }
      text = parts.join("\n");
    } finally {
      try { fs.unlinkSync(tmpPy); } catch {}
    }
    text = text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "").replace(/\r/g, "");
    const counts = {};
    const re = /(DEVICES|VISITORS|ALARMS|LOGS)\s+(\d+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      counts[m[1]] = parseInt(m[2], 10);
    }
    row("门禁设备 (AccessDevice)", `${counts.DEVICES ?? "?"} ${counts.DEVICES >= 3 ? "✅" : "⚠ (期望 ≥3)"}`);
    row("访客记录 (VisitorPass)", `${counts.VISITORS ?? "?"} ${counts.VISITORS >= 2 ? "✅" : "⚠ (期望 ≥2)"}`);
    row("异常报警 (AlarmEvent)", `${counts.ALARMS ?? "?"} ${counts.ALARMS >= 2 ? "✅" : "⚠ (期望 ≥2)"}`);
    row("开门日志 (DoorOpenLog)", `${counts.LOGS ?? "?"} ${counts.LOGS >= 4 ? "✅" : "⚠ (期望 ≥4)"}`);
    const demoOk = counts.DEVICES >= 3 && counts.VISITORS >= 2 && counts.ALARMS >= 2 && counts.LOGS >= 4;
    if (demoOk) success("演示数据完整");
    else error("演示数据缺失，请运行 npm run setup 重新 seed");
    results.push({ name: "演示数据完整性", ok: demoOk });
  } else {
    step("5/6  演示数据完整性（跳过，使用 -d/--data 启用）");
    warn("跳过数据完整性检查");
    results.push({ name: "演示数据完整性", ok: null });
  }

  // ── 6. API 连通性（数据接口） ──
  if (full) {
    step("6/6  数据接口连通性（devices/visitors/alarms/door-logs）");
    const endpoints = ["devices", "visitors", "alarms", "door-logs"];
    let allOk = true;
    for (const ep of endpoints) {
      const r = await request(`http://127.0.0.1:8000/api/${ep}/`);
      const ok = r.ok && r.status === 200;
      allOk = allOk && ok;
      let count = "-";
      try {
        const j = JSON.parse(r.body);
        count = Array.isArray(j?.results) ? `${j.results.length} 条 (分页)` : (Array.isArray(j) ? `${j.length} 条` : count);
      } catch {}
      row(`  /api/${ep}/`, `${fmt(ok)}  ${r.status}  ${count}`);
    }
    if (allOk) success("所有数据接口可用");
    else error("部分数据接口异常");
    results.push({ name: "数据接口连通性", ok: allOk });
  } else {
    step("6/6  数据接口连通性（跳过，使用 -a/--full 启用）");
    warn("跳过详细接口检查");
    results.push({ name: "数据接口连通性", ok: null });
  }

  // ── Summary ──
  log("");
  banner("健康检查摘要");
  log("");
  let pass = 0, fail = 0, skip = 0;
  for (const r of results) {
    const pad = " ".repeat(4);
    if (r.ok === true) {
      log(`${pad}${COLORS.green}[✔]${COLORS.reset} ${r.name}`);
      pass++;
    } else if (r.ok === false) {
      log(`${pad}${COLORS.red}[✗]${COLORS.reset} ${r.name}`);
      fail++;
    } else {
      log(`${pad}${COLORS.yellow}[-]${COLORS.reset} ${r.name}  (跳过)`);
      skip++;
    }
  }
  log("");
  row("通过", String(pass), 4);
  row("失败", String(fail), 4);
  row("跳过", String(skip), 4);
  log("");
  if (fail === 0) {
    success("✅ 系统健康检查全部通过！");
  } else {
    error(`❌ 有 ${fail} 项检查未通过，请排查后重新运行。`);
    info("提示：先运行 npm run setup 完成初始化，再运行 npm run start 启动服务");
    process.exit(1);
  }
}

main().catch((e) => {
  error(`检查出错: ${e.message}`);
  process.exit(2);
});
