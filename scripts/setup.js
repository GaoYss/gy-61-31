const {
  banner,
  step,
  success,
  warn,
  error,
  info,
  log,
  runSync,
  isWin,
  pythonBin,
  BACKEND_DIR,
  FRONTEND_DIR,
  fileExists,
  venvExists,
  sleep,
} = require("./_utils");
const path = require("path");
const fs = require("fs");

async function main() {
  const force = process.argv.includes("--force") || process.argv.includes("-f");
  const skipDeps = process.argv.includes("--skip-deps");

  banner("小区门禁系统 - 本地环境初始化");
  info("该脚本将自动完成：虚拟环境 → 依赖安装 → 数据库迁移 → 演示数据 → 前端依赖");
  log("");

  const checks = [];

  // ── Step 1: Python 虚拟环境 ──
  step("1/5  创建/检查 Python 虚拟环境");
  const venvDir = path.join(BACKEND_DIR, ".venv");
  if (venvExists() && !force) {
    success("虚拟环境已存在 (.venv)");
  } else {
    if (force && fileExists(venvDir)) {
      warn("--force 指定：删除旧的虚拟环境");
      fs.rmSync(venvDir, { recursive: true, force: true });
    }
    info("创建虚拟环境 backend/.venv ...");
    const pyCmd = isWin() ? "python" : "python3";
    const r1 = runSync(pyCmd, ["-m", "venv", ".venv"], BACKEND_DIR);
    if (r1.status !== 0) {
      error("创建虚拟环境失败，请确认 Python 3.10+ 已安装并可用");
      process.exit(1);
    }
    success("虚拟环境创建完成");
    await sleep(500);
  }
  checks.push({ name: "Python 虚拟环境", ok: true });

  // ── Step 2: 安装后端依赖 ──
  step("2/5  安装后端 Python 依赖");
  if (!skipDeps) {
    const r2 = runSync(pythonBin(), ["-m", "pip", "install", "--upgrade", "pip"], BACKEND_DIR);
    if (r2.status !== 0) warn("pip 升级失败，继续...");
    const r3 = runSync(pythonBin(), ["-m", "pip", "install", "-r", "requirements.txt"], BACKEND_DIR);
    if (r3.status !== 0) {
      error("后端依赖安装失败");
      process.exit(2);
    }
    success("后端依赖安装完成");
  } else {
    warn("跳过依赖安装 (--skip-deps)");
  }
  checks.push({ name: "后端依赖", ok: true });

  // ── Step 3: 数据库迁移 ──
  step("3/5  执行数据库迁移 (migrate)");
  const r4 = runSync(pythonBin(), ["manage.py", "migrate", "--noinput"], BACKEND_DIR);
  if (r4.status !== 0) {
    error("数据库迁移失败");
    process.exit(3);
  }
  success("数据库迁移完成");
  checks.push({ name: "数据库迁移", ok: true });

  // ── Step 4: 导入演示数据 ──
  step("4/5  导入演示数据 (seed_demo)");
  const r5 = runSync(pythonBin(), ["manage.py", "seed_demo"], BACKEND_DIR);
  if (r5.status !== 0) {
    error("演示数据导入失败");
    process.exit(4);
  }
  success("演示数据导入完成");
  checks.push({ name: "演示数据", ok: true });

  // ── Step 5: 安装前端依赖 ──
  step("5/5  安装前端 Node 依赖");
  const nodeModules = path.join(FRONTEND_DIR, "node_modules");
  if (!skipDeps) {
    if (fileExists(nodeModules) && !force) {
      success("前端 node_modules 已存在，跳过安装（使用 --force 重装）");
    } else {
      if (force && fileExists(nodeModules)) {
        warn("--force 指定：清理 node_modules");
        fs.rmSync(nodeModules, { recursive: true, force: true });
      }
      const r6 = runSync("npm", ["install"], FRONTEND_DIR);
      if (r6.status !== 0) {
        error("前端依赖安装失败");
        process.exit(5);
      }
      success("前端依赖安装完成");
    }
  } else {
    warn("跳过前端依赖安装 (--skip-deps)");
  }
  checks.push({ name: "前端依赖", ok: true });

  // ── Summary ──
  log("\n");
  banner("初始化完成");
  log("");
  checks.forEach((c) => success(`${c.name.padEnd(16)} OK`));
  log("");
  info("下一步：运行 npm run start  启动前后端服务");
  info("            npm run dev     同上（别名）");
  info("            npm run health  启动后执行健康检查");
  log("");
}

main().catch((e) => {
  error(`未预期的错误: ${e.message}`);
  process.exit(99);
});
