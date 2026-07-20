# Termux 运行审美者 B站采样台

## 1. 安装基础环境

在 Termux 里执行：

```bash
pkg update
pkg install python git
python -m pip install --upgrade pip
python -m pip install requests certifi qrcode rich
```

如果要把输出 CSV 放到手机下载目录，先授权存储：

```bash
termux-setup-storage
```

## 2. 获取项目

推荐直接从 GitHub 拉代码：

```bash
git clone https://github.com/inskyen/shenmei.git
cd shenmei
```

后续更新：

```bash
git pull
```

## 3. 配置 Supabase

在项目根目录创建 `.env.local`：

```text
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
SHENMEI_IMPORT_USERNAME=骨折眉
```

`SUPABASE_SECRET_KEY` 只放在本机 Termux，不提交 Git。

## 4. 启动终端界面

```bash
python3 scripts/bili_aesthete_tui.py
```

如果手机终端太窄，或者 Rich 显示异常，可以退回纯文本模式：

```bash
python3 scripts/bili_aesthete_tui.py --plain
```

菜单含义：

```text
1. 扫描并展示高收藏夹用户
2. 只扫描视频评论用户
3. 从扫描结果合并
4. 查看/编辑候选池
5. 高级工具
0. 退出
```

高级工具里才会出现 Supabase 写入和 fid 排除：

```text
1. 预览未入库收藏夹
2. 写入指定收藏夹视频
3. 排除/取消排除 fid
0. 返回主菜单
```

预览未入库收藏夹会按当前“收藏下限”过滤，默认洗掉 100 条以下的收藏夹。

候选池文件：

```text
.local/bilibili_user_scan/candidate_board.json
```

菜单 4 支持：

```text
d 隐藏
r 恢复
i 切换已入库/未入库
w 修改展示权重
n 添加备注
a 显示/隐藏已隐藏项
q 返回
```

## 5. 推荐流程

第一次：

```text
1. 选择菜单 1
2. 输入 BV 号或视频链接
3. 选择强制扫码登录 y
4. 手机 B站 App 扫码
5. 等扫描完成，看 HIGH_VALUE 用户、mid、默认收藏夹 ID
```

正式写入：

```text
1. 回到菜单
2. 选择 5. 高级工具
3. 选择 2. 写入指定收藏夹视频
4. 输入收藏夹 ID
5. 预览无误后输入 YES 确认
```

如果不想导入某个收藏夹，先在高级工具里添加它的 fid。

## 6. 文件位置

Cookie：

```text
.local/bilibili_user_scan/cookies.json
```

扫描结果：

```text
.local/bilibili_user_scan/outputs/
```

菜单状态：

```text
.local/bilibili_user_scan/tui_state.json
```
