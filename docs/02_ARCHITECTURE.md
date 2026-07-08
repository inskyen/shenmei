# 02_ARCHITECTURE：系统架构蓝图

## 1. 技术栈选型
* 前端：Next.js / React / TailwindCSS
* 后端/DB：Supabase (鉴权 + RLS安全)
* 部署：GitHub Actions + Nginx (反向代理)

## 2. 逻辑架构图 (Mermaid 示例)
```mermaid
graph TD
    User((用户)) --> Nginx[Nginx 反向代理]
    Nginx --> Frontend[Next.js 前端]
    Frontend --> Auth[Supabase 鉴权层]
    Auth --> DB[(Supabase Database)]