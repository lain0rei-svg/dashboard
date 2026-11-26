# 投资净值监测

简体中文静态网页，按汇丰中国和工商银行展示八只产品。行情数据存放在 `site/data.json`。逐只核验记录及未解决问题见 [官方数据验证报告](验证报告.md)。

## 通过 GitHub 发布

1. 解压项目 ZIP。使用 GitHub Desktop 打开 **File → Add Local Repository**，选择解压后的 `dashboard` 文件夹。若提示该目录尚未建立 Git 仓库，从提示创建仓库，或用 **File → New Repository** 在此目录建立仓库。检查文件列表里包含 `.github/workflows/dashboard.yml`。
2. 提交全部项目文件，确认分支为 `main)。点击 **Publish repository**，选择公开仓库。此仓库包含公开产品资料。
3. 在 GitHub 网页打开仓库，进入 **Settings → Pages**，将 **Build and deployment → Source** 设为 **GitHub Actions**。
4. 打开 **Actions → 净值更新与发布 → Run workflow**，选择 `main`，再点绿色的 **Run workflow**。如果此前的首次推送运行早于 Pages 设置，可以从 Actions 手动运行。
5. 在运行详情中的发布任务查看链接，或从 **Settings → Pages** 打开站点。以后可用同样的 **Run workflow** 手动检查行情。

流程在 `main` 推送时发布现有数据。定时与手动运行会先检查公开报价、保存 JSON，再由同一次运行部署。北京时间计划检查 09:17、14:17、19:17、23:17，GitHub 可能延后执行。定时任务要求工作流在默认分支。若仓库规则阻止 Actions 向 `main` 写入，请在组织或仓库策略层授权此工作流的正常写入路径。

发布使用 GitHub Pages 官方自定义工作流。[GitHub Pages 部署文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 页面口径

- 日涨跌引用官方明确给出的相对前一交易日的单位净值变化。缺字段时显示不可计算。
- 周以估值日所在周的周一为界，月以估值日当月月初为界。比较期初前候选收盘估值与最新估值。现阶段只接受恰好落在上一周或上月最后一个平日的已存真实估值作为基准。假期导致估值提前且缺乏完整日历时，保守显示不可计算。
- 分派份额的涨跌为价格变化。含分红总回报当前不可计算，原因见报告。数据和历史图使用实际估值日，图中两点之间的线段仅连接已记录点。
- 初始记录为核验快照，`retrievedAt` 为证据采集时间，`date` 为估值日。自动任务仅追加较新的估值日，同日冲突或来源异常时保留原记录，页面会显示检查状态。失败任务部署完状态后在 Actions 留下失败标记。

## 本地运行与测试

在项目目录运行以下命令。网页没有第三方前端依赖。

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory site
```

浏览器访问 http://127.0.0.1:8000 。如需运行测试或实际检查公开报价，在另一个终端运行以下命令。更新命令会写入本地 `site/data.json`。

```sh
python3 -m unittest discover -s tests
node --test tests/*.test.mjs
python3 scripts/update.py
```
