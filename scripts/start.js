const {
  banner,
  step,
  success,
  warn,
  error,
  info,
  log,
  runAsync,
  runSync,
  pythonBin,
  BACKEND_DIR,
  FRONTEND_DIR,
  sleep,
  waitForHttp,
} = require("./_utils");

const BACKEND_URL = "http://127.0.0.1:8000/api/health/";
const FRONTEND_URL = "http://127.0.0.1:5173/";
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 5173;

const children = [];

function cleanup(signal) {
  log("");
  info(`收到 ${signal}，正在停止服务...`);
  for (const proc of children) {
    try {
      if (proc.pid && !proc.killed) {
        process.kill(-proc.pid, "SIGTERM");
      }
    } catch {
      try { proc.kill("SIGTERM"); } catch {}
    }
  }
  setTimeout(() => {
    log("服务已停止，再见 👋");
    process.exit(0);
  }, 800).unref();
}

["SIGINT", "SIGTERM", "SIGHUP"].forEach((sig) =>
  process.on(sig, () => cleanup(sig))
);

async function main() {
  const skipSetup = process.argv.includes("--no-setup");
  const backendOnly = process.argv.some((a) => a === "--backend-only" || a.startsWith("--backend-only=") && !a.endsWith("=false"));
  const frontendOnly = process.argv.some((a) => a === "--frontend-only" || a.startsWith("--frontend-only=") && !a.endsWith("=false"));
  const launchBackend = !frontendOnly;
  const launchFrontend = !backendOnly;

  banner("启动前后端开发服务");
  info(`后端:  http://127.0.0.1:${BACKEND_PORT}`);
  info(`前端:  http://127.0.0.1:${FRONTEND_PORT}`);
  info(`健康:  http://127.0.0.1:${BACKEND_PORT}/api/health/`);
  log("按 Ctrl+C 停止所有服务\n");

  if (!skipSetup) {
    step("预检：数据库迁移 + 演示数据");
    const r1 = runSync(pythonBin(), ["manage.py", "migrate", "--noinput"], BACKEND_DIR);
    if (r1.status !== 0) {
      warn("迁移异常，尝试继续启动...");
    } else {
      success("迁移检查通过");
    }
    const r2 = runSync(pythonBin(), ["manage.py", "seed_demo"], BACKEND_DIR);
    if (r2.status !== 0) warn("seed_demo 异常，继续启动...");
    else success("演示数据检查通过");
  }

  // 启动后端
  if (launchBackend) {
    step("启动 Django 后端服务");
    const be = runAsync(
      pythonBin(),
      ["manage.py", "runserver", `127.0.0.1:${BACKEND_PORT}`],
      BACKEND_DIR
    );
    children.push(be);
    info(`后端进程 PID=${be.pid}`);
  }

  // 启动前端
  if (launchFrontend) {
    step("启动 Vite 前端服务");
    const fe = runAsync(
      "npm",
      ["run", "dev", "--", "--host", "127.0.0.1", "--port", `${FRONTEND_PORT}`],
      FRONTEND_DIR
    );
    children.push(fe);
    info(`前端进程 PID=${fe.pid}`);
  }

  // 等待服务就绪
  if (launchBackend || launchFrontend) {
    step("等待服务就绪（最多 60 秒）");
    if (launchBackend) {
      const okBE = await waitForHttp(BACKEND_URL, 60000, 2000);
      if (okBE) success(`后端就绪  ${BACKEND_URL}`);
      else warn(`后端等待超时，请手动检查: ${BACKEND_URL}`);
    }
    if (launchFrontend) {
      const okFE = await waitForHttp(FRONTEND_URL, 60000, 2000);
      if (okFE) success(`前端就绪  ${FRONTEND_URL}`);
      else warn(`前端等待超时，请手动检查: ${FRONTEND_URL}`);
    }
  }

  log("");
  banner("服务已启动");
  info("后端 API：  http://127.0.0.1:8000/api/");
  info("健康检查：  http://127.0.0.1:8000/api/health/");
  info("前端页面：  http://127.0.0.1:5173/");
  info("后台管理：  http://127.0.0.1:8000/admin/");
  log("");
  warn("按 Ctrl+C 停止服务");

  // 保持进程
  process.stdin.resume();
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  error(`启动失败: ${e.message}`);
  cleanup("ERROR");
  process.exit(1);
});
