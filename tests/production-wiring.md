# J 轨挂载测试与变异自检

验证日期：2026-10-21。仅修改 `tests/`，没有新增依赖，也没有修改 `package.json` / `package-lock.json` 或业务源码。保留工作区开始时已有的业务改动。

## 运行

```sh
npm test
node tests/run-wiring-mutations.mjs
npm run build
```

实际结果：原有 51 项与新增 7 项合计 **58/58 通过**，无 skip；构建通过（TypeScript + Vite，103 modules transformed）。变异脚本先运行原始挂载测试，逐个注入 12 个变异并要求对应测试因 `ERR_ASSERTION` 失败，最后重新验证原始挂载测试全绿。12/12 变异均被捕获。

变异发生在测试加载器编译生产模块前的内存字符串中；每次使用独立子进程。锚点必须唯一匹配，语法错误、加载错误或环境错误不能算变异成功。脚本不写入 `src/`，因此不需要落盘恢复。执行前后核对，`src/` 和两个 package 文件的内容均未改变。收尾时检测到 `scripts/analyze-email-content.mjs` 被外部更新，本任务未写入或回滚该文件。

## 四个缺口

| 缺口 | 挂载与断言 | 实际捕获的变异 |
| --- | --- | --- |
| J1 Provider 刷新失效 | 同一个 `SiteProvider` 下挂载两个真实消费者。真实邮件 hook 经网络首次加载、online 刷新、公开 retry、US/UK 切换；检查消费者聚合数量、对象共享及聚合调用次数。另用可订阅数据源保持数组引用不变，单独验证 loading/error/incomplete → ready 的 status 依赖。 | `provider-market-only`、`provider-without-emails`、`provider-without-status` 全部变红。 |
| J2 自动刷新链路 | 真实订阅启动生产 interval；控制计时器触发五分钟回调，另触发 online / visibilitychange。真实 `email-data` → `supabase` 双层缓存、邮件刷新通知、分析 hook/cache 与分析读取器全部参与，只替换 fetch 和时钟。 | `timer-without-force`、`online-without-force`、`supabase-without-force`、`analysis-without-refresh-subscription`、`analysis-without-force` 全部变红。 |
| J3 JSON 组件窗口 | 挂载真实 `MarketComparison`，经真实邮件 hook 与 JSON adapter 读取六份快照文件；只模拟 Vite `import.meta.glob` 的文件发现。读取实际渲染宿主树，检查 770 封、92 天、2026-07-16 – 2026-10-15 标注、品牌周均以及零网络请求。 | `comparison-fixed-live-window` 变红。 |
| J4 URL 与 Provider 联动 | 挂载真实 `App.Dashboard`、`SiteProvider` 和两个额外 `useUrlSync` 实例。生产 Dashboard effect 负责 URL 与 Provider 双向同步；模拟 popstate/hashchange、生产 notifyUrlChanged、Provider 切站点与同一 act 内多实例连续写入。检查两个 hook 的完整状态、Provider 站点和消费者聚合，覆盖显式 all 与未指定站点。 | `url-without-navigation-restore`、`app-without-url-market-restore`、`url-stale-render-writes` 全部变红。 |

J1 聚合调用次数依次为：首次 ready **1**，首次切 UK **2**，切回 US 与修改筛选仍 **2**，数据刷新 **3**，刷新后切 UK **4**，retry 恢复 ready **5**。消费者数量不增加聚合次数。

J2 故意将首轮完成时间推迟 20 ms，因此 interval 到点时内外缓存都仍在 TTL 内，删除 force 不能靠自然过期侥幸通过。每个完整刷新轮次恰好产生邮件 schema GET ×1、邮件 HEAD ×2 / GET ×1、分析 HEAD ×2 / GET ×1。online 场景还会在第二轮未完成时再次触发事件，检查第三轮实际请求和旧分析请求取消。卸载后检查定时器、online 与 visibilitychange 监听均停止生效。

## 环境限制与替代验证边界

本机 npm 联网被沙箱拒绝，预装 Chromium 也因 `setsockopt: Operation not permitted` 启动失败。因此采用 `mounted-dom.mjs` 中的最小 DOM/History 宿主，配合真实 React DOM `createRoot` 和 React `act` 完成挂载、effect、Context、更新与卸载验证；没有伪造 React hooks 或生产缓存/导航处理器。

四个生产接线缺口均有挂载级断言及对应变异失败证据。该方式不等同于完整浏览器 E2E：**未覆盖布局、滚动恢复、浏览器原生 back/forward 历史栈和真实鼠标/键盘事件合成**。History 只提供 URL 写入，导航事件使用 Node 原生 EventTarget 显式派发。需要上述能力时，应在允许安装 DOM 库或启动浏览器的环境中补做浏览器验证。

J4 仅旁路无关视图输出和遥测，保留被测的 Dashboard 同步 effect；邮件列表完整 UI 不在本测试覆盖范围。J1-status 的外部 store 仅用于隔离“数组引用相同、状态不同”的依赖条件，主 J1 场景使用真实邮件 hook、缓存和网络读取器。
