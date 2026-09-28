# 1-drink-and-run · 喝一杯就撤

**NOCTURNE — 威士忌酒吧实时 3D 场景。**

[▶ 在线体验 · Vercel](https://1-drink-and-run.vercel.app/)

一杯未喝完的威士忌、一支仍在冒烟的雪茄、一枚留在湿润黑胡桃木吧台上的弹壳。用灯光、材质和细小动态，讲一个没有人物出场的故事。

本仓库已替换为酒吧场景完整版，原有江户切子独立展示页不再作为入口。

## 体验

- 入场镜头结束后，拖动环绕；滚轮或双指缩放。
- 轻点杯子触发衰减液面波动；底部可复位视角、调整顶灯。
- 右上角收纳景深、Bloom、镜头光晕和调色控制。
- 默认开启景深；手机降低渲染分辨率与 SSR 步数，并限制至 30 FPS。

## 渲染与场景

- Three.js r180 / WebGL 2，PBR 玻璃、薄杯壁、匹配内腔的琥珀色透射酒液及弯月面。
- 酒吧 HDR 参与环境照明与反射，背景保持黑色；静态反射光源强化玻璃轮廓。
- 半浮点 HDR 后处理、设备支持时使用 4× MSAA、湿桌面 SSR、间接光 SSAO。
- Bloom、景深、体积光、六边形 / 八边形镜头鬼影和虹彩光晕。
- AgX 后叠加对比度、饱和度与冷暖分离调色。
- 离线烘焙桌面间接光；基于杯体切面的焦散采样。
- 做旧烟灰缸、雪茄烟雾、弹壳、血迹、印字纸张、硬币与偶尔快速经过的昆虫。
- 本地材质贴图、尘埃粒子、缓存阴影与按需液面更新。

液面采用轻量阻尼波动模型，不是完整流体求解；SSR、体积光和焦散有实时近似限制。移动端设置旨在控制成本，不保证所有手机达到目标帧率。

## 本地运行

无需安装 npm 依赖或构建，运行依赖和素材随项目提供。安装 Python 3 后，在仓库根目录执行：

```bash
python -m http.server 8000 --directory dist
```

访问 http://localhost:8000 。不要通过 file:// 直接打开页面。

## Vercel

仓库内的 vercel.json 已配置静态输出目录 dist。导入本仓库时选择 **Other**，Root Directory 保持仓库根目录，不需要环境变量。

在线地址：https://1-drink-and-run.vercel.app/

已部署酒吧场景完整版，连接 GitHub 主分支自动更新。请使用支持 WebGL 2 的浏览器访问。

## 工程结构

| 文件 / 目录 | 用途 |
| --- | --- |
| dist/index.html、style.css | 页面与移动端 UI |
| dist/scene.js | 场景、灯光、相机入场和交互 |
| dist/cup-model.js、optics.js | 杯体几何与光学参数 |
| dist/story.js、liquid-motion.js | 场景道具、酒液与阻尼运动 |
| dist/cigar.js、wear.js | 雪茄烟雾与做旧材质 |
| dist/render-pipeline.js | SSR、SSAO 与后处理串联 |
| dist/cinematic-pass.js、lens-flare.js、film-grade.js | 景深、光晕和调色 |
| dist/assets/ | HDR、贴图与烘焙数据 |
| dist/vendor/ | Three.js 与第三方依赖、许可证 |
| bake-*.mjs、bake-*.py、scripts/ | 离线素材生成脚本 |

## 检查

安装支持 ES modules 的 Node.js 后，在仓库根目录运行：

```bash
node --experimental-loader ./verify-imports.mjs verify-effects.mjs
```

检查覆盖 HDR / MSAA 配置、后处理切换、SSR 黑屏回归保护、景深深度连接及烘焙数据；它不是 GPU 画面测试或真机性能测试。

## 素材与许可

详见 [ASSET-CREDITS](dist/ASSET-CREDITS.md)。Three.js 和 three-mesh-bvh 使用 MIT 许可；Warm Bar HDR 来自 Poly Haven（CC0）。保留第三方许可证及署名。
