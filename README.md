# 1-drink-and-run · 喝一杯就撤

江户切子 · 光之器（The Kiriko Atelier）——基于 Three.js 的交互式玻璃杯展示。以程序化切面造型、酒吧 HDR 环境和威士忌交互，呈现玻璃随视角变化的光影。

> 本仓库保留现有江户切子工程。Vercel 在线地址将在部署成功后补充。

## 功能

- 程序化杯体与切面，可通过调参面板调整造型及渲染参数。
- 360° 酒吧 HDR 环境、冷暖灯光、焦散效果及柔和接触投影。
- 威士忌交互与电影感后处理，AgX 色调映射。
- 自动旋转、细节视角、视角复位和曝光控制。
- 鼠标拖动 / 单指环绕，滚轮 / 双指缩放。
- 移动端采用更低像素比和移动端杯体配置；遵循系统减少动态效果设置，默认关闭自动旋转。

## 本地运行

无需 npm 安装或构建。安装 Python 3 后，在仓库根目录运行：

```bash
python -m http.server 8000 --directory dist
```

打开 http://localhost:8000 。请通过 HTTP 服务访问，不要直接双击 HTML 文件。浏览器需支持 WebGL 2；实际流畅度取决于设备、分辨率与渲染参数。

## 工程结构

```text
dist/
  index.html          页面入口
  style.css           页面布局与样式
  app.js              场景、灯光、相机及交互主循环
  cup-model.js        程序化杯体
  bar-stage.js        酒吧环境
  whisky.js           威士忌与杯体交互
  caustics.js         焦散
  soft-projection.js  柔和投影
  cinematic.js       后处理
  tuning.js          调参面板
  vendor/            本地 Three.js 依赖
```

## Vercel 部署

导入 GitHub 仓库 `DaveleeX/1-drink-and-run`，使用以下配置：

| 配置项 | 值 |
| --- | --- |
| Framework Preset | Other |
| Root Directory | `dist` |
| Build Command | 留空（覆盖默认值） |
| Output Directory | `.` |
| Install Command | 留空 |

工程为静态页面，不需要服务器环境变量。连接 GitHub 后，后续提交可由 Vercel 自动部署。

## 说明

本项目是实时渲染与交互展示，焦散、投影及液体效果用于视觉表现，不等同于完整的离线光线追踪或流体求解。第三方代码与素材的使用应遵循各自的许可。
