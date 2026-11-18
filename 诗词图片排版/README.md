# 诗词图片排版（v2.1）

按《`诗词网格排规范.md`（v2.1）》将诗词内容排成 **1440×1920 PNG**（近体诗红底 `#900202`、宋词蓝底 `#1E0692`）。
非固定使用的可选视觉扩展能力（插件一：`watermark` 右下角对称大字暗纹 4.0% + `marginalia` 右上角 25 px 竖排古籍词序 25.0%；插件二：`<...>` 12.0% 浅金底衬 + 70.0% 底边虚线）已独立拆分为插件包，详见《`视觉插件说明.md`》与 `poemgrid/plugins.py`。

## 快速使用

```bash
pip install -r requirements.txt
# 1. 标准版排版（不启用插件）
python make_poem.py poems/绝句-春天停下了么.toml

# 2. 启用视觉插件版（见 poems/浣溪沙-种花人立落花中.toml）
python make_poem.py poems/浣溪沙-种花人立落花中.toml --zip
```

## 目录结构

- `诗词网格排规范.md`：v2.1 基础网格排核心规范（必用底座）
- `视觉插件说明.md`：v2.1 独立视觉插件说明包（按需引用）
- `make_poem.py`：命令行入口（生成 PNG、SVG、ZIP 与复测报告）
- `poemgrid/`
  - `template.py`：基础模板固定参数（近体诗、宋词、小黄标）
  - `plugins.py`：可选视觉插件参数与构建逻辑（`watermark`、`marginalia`、`line_box`）
  - `layout.py`：网格排水平与纵向坐标推算
  - `render.py`：SVG 轮廓路径生成与栅格化（支持 `resvg_py` 与 `pycairo`）
  - `measure.py`：50% 覆盖率交点法导出复测与参考图对照
  - `glyphs.py` / `mark_path.py`：字体轮廓读取与小黄标矢量路径
- `poems/`：示例 TOML 配置
