const {
  banner,
  step,
  success,
  warn,
  error,
  info,
  log,
  runSync,
  pythonBin,
  BACKEND_DIR,
  fileExists,
} = require("./_utils");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

async function confirm(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${msg} (y/N): `, (a) => {
      rl.close();
      resolve(/^y(es)?$/i.test(a.trim()));
    });
  });
}

async function main() {
  const hard = process.argv.includes("--hard");
  const yes = process.argv.includes("-y") || process.argv.includes("--yes");

  banner("重置本地开发环境");
  info("默认：删除数据库 + 重新迁移 + 重新 seed");
  if (hard) {
    warn("--hard：额外删除 node_modules、.venv 和构建产物");
  }
  log("");

  if (!yes) {
    const ok = await confirm("确认执行重置？该操作不可撤销");
    if (!ok) {
      warn("已取消。");
      process.exit(0);
    }
  }

  // 删除数据库
  step("1/4  删除数据库文件");
  const db1 = path.join(BACKEND_DIR, "db.sqlite3");
  const deleted = [];
  for (const p of [db1]) {
    if (fileExists(p)) {
      fs.unlinkSync(p);
      deleted.push(p);
    }
  }
  if (deleted.length) deleted.forEach((p) => success(`已删除: ${path.relative(process.cwd(), p)}`));
  else warn("无数据库文件");

  // Hard reset: 删除 venv / node_modules
  if (hard) {
    step("2/4  清理 .venv 和 node_modules");
    const venv = path.join(BACKEND_DIR, ".venv");
    const nm = path.join(__dirname, "..", "frontend", "node_modules");
    const dist = path.join(__dirname, "..", "frontend", "dist");
    if (fileExists(venv)) { fs.rmSync(venv, { recursive: true, force: true }); success("已删除 backend/.venv"); }
    if (fileExists(nm)) { fs.rmSync(nm, { recursive: true, force: true }); success("已删除 frontend/node_modules"); }
    if (fileExists(dist)) { fs.rmSync(dist, { recursive: true, force: true }); success("已删除 frontend/dist"); }
  } else {
    step("2/4  跳过依赖清理（使用 --hard 执行彻底清理）");
    warn("未清理依赖");
  }

  // 重新迁移
  step("3/4  重新执行数据库迁移");
  const r1 = runSync(pythonBin(), ["manage.py", "migrate", "--noinput"], BACKEND_DIR);
  if (r1.status !== 0) {
    error("迁移失败，请先运行 npm run setup 安装依赖");
    process.exit(1);
  }
  success("迁移完成");

  // 重新 seed
  step("4/4  重新导入演示数据");
  const r2 = runSync(pythonBin(), ["manage.py", "seed_demo"], BACKEND_DIR);
  if (r2.status !== 0) {
    error("seed_demo 失败");
    process.exit(2);
  }
  success("演示数据已重置");

  log("");
  banner("重置完成");
  info("运行 npm run start 启动服务");
  info("运行 npm run health 进行健康检查");
  if (hard) warn("由于使用了 --hard，请先运行 npm run setup 重新安装依赖");
  log("");
}

main().catch((e) => {
  error(`重置失败: ${e.message}`);
  process.exit(99);
});
