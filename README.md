# 小区智能门禁系统

Django + React 实现的小区智能门禁管理系统，覆盖门禁设备状态、访客通行记录、异常报警和开门日志查询。

## 功能模块

- 后端 `backend/access` 按模型、序列化器、视图、管理命令拆分，提供 REST API。
- 前端 `frontend/src/modules` 按业务页面拆分为运行总览、门禁设备、访客记录、异常报警、开门日志。
- 提供演示数据命令 `python manage.py seed_demo`。
- 提供 `docker-compose.yml` 一键启动前后端。
- **统一初始化、启动和健康检查脚本**（见下文）。

---

## 🚀 快速开始（推荐）

三条命令即可完成从初始化到验证的完整流程，不再需要手动分别执行后端/前端步骤：

```bash
# 1) 初始化：自动创建虚拟环境 → 装依赖 → 数据库迁移 → 导入演示数据 → 装前端依赖
npm run setup

# 2) 启动：同时启动后端 (Django :8000) + 前端 (Vite :5173)
npm run start

# 3) 健康检查：启动后另开终端，验证后端、前端、接口、数据完整性
npm run health:full
```

> 所有命令都在项目**根目录**执行。首次交接时只需按顺序执行上面三步即可。

---

## 📋 命令速查表（根目录执行）

| 命令 | 说明 |
|---|---|
| `npm run setup` | 一键初始化：虚拟环境、依赖、迁移、演示数据、前端依赖 |
| `npm run setup:force` | 同上，但强制重建 .venv 和 node_modules |
| `npm run start` / `npm run dev` | 启动前后端（启动前会自动补做 migrate 和 seed_demo） |
| `npm run start:backend` | 只启动后端 |
| `npm run start:frontend` | 只启动前端 |
| `npm run health` | 基础健康检查（后端健康端点、API入口、前端、统计接口） |
| `npm run health:data` | 健康检查 + 演示数据完整性校验 |
| `npm run health:full` | 健康检查 + 数据完整性 + 所有数据接口连通性 |
| `npm run reset` | 仅删除数据库，重新迁移和 seed |
| `npm run reset:hard` | 彻底重置：删数据库 + .venv + node_modules，重新迁移 + seed |
| `npm run migrate` | 单独执行 Django migrate |
| `npm run seed` | 单独执行演示数据 seed_demo |

---

## 🔍 健康检查输出示例

`npm run health:full` 会依次检查：

1. **后端健康端点** `api/health/`（新增）：数据库连通性、模型可访问
2. **API 入口** `api/`：DRF 路由是否生效
3. **前端服务** :5173：能否返回 HTML
4. **统计接口** `api/stats/`：各业务表计数
5. **演示数据完整性**：`AccessDevice≥3 / VisitorPass≥2 / AlarmEvent≥2 / DoorOpenLog≥4`
6. **数据接口连通性**：`devices / visitors / alarms / door-logs`

所有检查通过会输出绿色 `[✔]`，任何一项失败都会以非零退出码结束，便于 CI/交接清单自动化校验。

```
═════════════════════════════════════════╗
          健康检查摘要                   ║
═════════════════════════════════════════╝

    [✔] 后端健康
    [✔] 后端 API 入口
    [✔] 前端服务
    [✔] 统计接口
    [✔] 演示数据完整性
    [✔] 数据接口连通性

    通过  6
    失败  0
    跳过  0

✅ 系统健康检查全部通过！
```

---

## 访问地址

| 服务 | 地址 |
|---|---|
| 前端页面 | http://127.0.0.1:5173 |
| 后端 API 根 | http://127.0.0.1:8000/api/ |
| 健康检查 | http://127.0.0.1:8000/api/health/ |
| 后台管理 | http://127.0.0.1:8000/admin/ |

---

## 手动本地开发（如不使用统一脚本）

后端：

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000
```

前端：

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

---

## Docker Compose 启动

```bash
docker compose up --build
```

启动后访问：

- 前端：http://127.0.0.1:19080
- 后端 API：http://127.0.0.1:18080/api/
- 健康检查：http://127.0.0.1:18080/api/health/

---

## 主要 API

- `GET /api/health/`：**健康检查**（新增，无鉴权）
- `GET /api/stats/`：总览统计
- `GET /api/devices/`：门禁设备列表
- `GET /api/visitors/`：访客通行记录
- `GET /api/alarms/`：异常报警
- `GET /api/door-logs/`：开门日志，支持 `keyword`、`result`、`opener_type` 查询参数

---

## 交接核对清单（Checklist）

执行完以下三步即可放心交接：

- [ ] `npm run setup` 无报错退出
- [ ] `npm run start` 后浏览器可访问 http://127.0.0.1:5173 并看到仪表盘
- [ ] `npm run health:full` 全部为绿色 `[✔]`（0 失败）
