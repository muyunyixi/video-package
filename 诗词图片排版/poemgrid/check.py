"""副标题（封面腰封）、标点、平台标题与正文高亮防重复规范检查（v2.6）。

规范要点：
1. 核心架构：正文图内的副标题即封面腰封，平台标题直接提取腰封文字；小红书可另配单张金句大字图作首图封面。
2. 副标题二选一：
   - 优先自拟：白话钩子、巧思反差、细节解读，或古典正题（如 客中、中秋）。
   - 首句兜底：想不出合适标题时直接取首句，不单设“金句档”。
3. 标点规范：图内腰封一律用空格代逗号（仅定语气时留问号、感叹号）；平台标题恢复正常中文逗号。
4. 平台前缀：
   - 自拟标题：长度足够直接裸发；字数较短（<=4字）时前置词牌名或诗体（如 浣溪沙·客中）。
   - 首句兜底：无论长短，一律前置词牌名或诗体（如 浣溪沙·首句），明确作品索引身份，与金句大字封面拉开分工。
5. 正文高亮：改色标黄（[...]）与选中底色（<...>）全留给正文金句或对仗句；
   若首句已作副标题，正文即取消对该句的强调，绝不重复。
"""

import re

# 图内腰封禁止出现的非语气标点（逗号、句号、顿号、分号、冒号等；仅定语气时留问号、感叹号）
FORBIDDEN_SUB_PUNCT = re.compile(r"[，,。\.、；;：:]")
# 切分诗句用的标点
CLAUSE_SPLIT = re.compile(r"[，。、；：？！…—\s]+")
# 清洗文本用于内容比对（去掉所有常见标点与空白）
CLEAN_RE = re.compile(r"[，。、；：？！…—·《》〈〉“”‘’（）「」『』【】〔〕〖〗,.;:?!'\"()\[\]\s]+")
# 明显白话/现代钩子特征字词（用于辅助判断是否不加前缀）
MODERN_HINT = re.compile(r"[吗么呢吧啊呀啦哦的了着过会给怎么为啥为什么什么是不是能不能|？！?!]")


def _clean(s):
    return CLEAN_RE.sub("", s or "")


def _extract_clauses(lines):
    """按行拆分所有分句，返回 [(row_idx, clause_idx, raw_clause, clean_clause, start_col, end_col), ...]。"""
    out = []
    for r, line in enumerate(lines):
        if not line:
            continue
        pos = 0
        cidx = 0
        for m in re.finditer(r"[^，。、；：？！…—\s]+", line):
            raw = m.group(0)
            cln = _clean(raw)
            if cln:
                out.append((r, cidx, raw, cln, m.start(), m.end()))
                cidx += 1
    return out


def suggest_platform_title(title, subtitle, sub_kind):
    """根据腰封副标题生成推荐平台标题，返回 (平台标题, 说明)。"""
    sub = (subtitle or "").strip()
    if not sub:
        return title, "无副标题，仅用主标题"

    # 图内腰封空格恢复为正常中文逗号
    restored = re.sub(r"\s+", "，", sub)
    # 去掉标点后算有效字数
    pure_len = len(_clean(restored))

    if sub_kind == "首句兜底":
        return f"{title}·{restored}", "首句兜底，无论长短一律前置词牌/诗体以明确作品身份"

    if sub_kind == "疑似金句档":
        return restored, "请先按规范改为自拟或首句兜底"

    # 自拟标题：长度足够直接裸发；字数较短（≤4字且非现代钩子）时前置词牌/诗体
    is_modern = bool(MODERN_HINT.search(restored)) or ("，" in restored)
    if not is_modern and pure_len <= 4:
        return f"{title}·{restored}", "自拟标题字数较短（≤4字），前置词牌/诗体"
    return restored, "自拟标题长度足够，直接裸发"


def check_copy_rules(cfg, lay):
    """检查副标题（腰封）、标点规范、平台标题与正文高亮防重复规则。

    返回 dict:
      - sub_kind: '空' | '首句兜底' | '自拟' | '疑似金句档'
      - platform_title: 建议平台标题
      - platform_note: 平台标题判定说明
      - warnings: 违规/风险提醒列表
      - notes: 正常通过说明列表
    """
    title = (cfg.get("title") or "").strip()
    sub = (cfg.get("subtitle") or "").strip()
    sub_clean = _clean(sub)

    warnings = []
    notes = []

    if not sub:
        warnings.append("未设置副标题（封面腰封）：规范要求优先自拟或用首句兜底。")
        return dict(
            sub_kind="空",
            platform_title=title,
            platform_note="无副标题",
            warnings=warnings,
            notes=notes,
        )

    # 1. 标点规范检查：图内腰封用空格代逗号（仅定语气时留 ？/！）
    bad_p = FORBIDDEN_SUB_PUNCT.findall(sub)
    if bad_p:
        uniq = "、".join(dict.fromkeys(bad_p))
        suggested_sub = re.sub(r"[，,、；;]+", " ", sub).rstrip("。.")
        warnings.append(
            f"腰封标点不合规范：副标题含「{uniq}」，图内腰封应用空格代逗号（仅定语气时留？/！），"
            f"建议改为「{suggested_sub}」。"
        )
    else:
        notes.append("腰封标点规范：无逗号/句号等非语气标点。")

    # 2. 提取正文纯文本与分句，判定副标题类型（首句兜底 / 自拟 / 疑似金句档）
    body_texts = [l["text"] for l in lay["body"]]
    non_empty_rows = [(i, t) for i, t in enumerate(body_texts) if t]
    clauses = _extract_clauses(body_texts)

    first_row_idx = non_empty_rows[0][0] if non_empty_rows else -1
    first_row_clean = _clean(non_empty_rows[0][1]) if non_empty_rows else ""
    first_clause_clean = clauses[0][3] if clauses else ""

    sub_kind = "自拟"
    matched_first_span = None  # (row_idx, start_col, end_col)
    matched_other_clause = None

    if sub_clean and (sub_clean == first_clause_clean or sub_clean == first_row_clean):
        sub_kind = "首句兜底"
        if sub_clean == first_clause_clean and clauses:
            r0, _, _, _, s0, e0 = clauses[0]
            matched_first_span = (r0, s0, e0)
        elif first_row_idx >= 0:
            matched_first_span = (first_row_idx, 0, len(body_texts[first_row_idx]))
        notes.append("副标题类型：首句兜底。")
    else:
        # 检查是否直接截取了正文中的非首句（不单设“金句档”）
        for r, cidx, raw, cln, sc, ec in clauses[1:]:
            if sub_clean and (sub_clean == cln or (len(sub_clean) >= 4 and sub_clean in cln)):
                matched_other_clause = (r, raw, sc, ec)
                break
        if matched_other_clause is None:
            for r, t in non_empty_rows[1:]:
                if sub_clean and sub_clean == _clean(t):
                    matched_other_clause = (r, t, 0, len(t))
                    break

        if matched_other_clause is not None:
            sub_kind = "疑似金句档"
            r_hit, raw_hit, _, _ = matched_other_clause
            warnings.append(
                f"副标题与正文第{r_hit + 1}行「{raw_hit}」重合：按规范副标题仅二选一"
                f"（优先自拟或首句兜底），不单设“金句档”。"
            )
        else:
            notes.append("副标题类型：自拟（钩子/解读/古典正题）。")

    # 3. 正文高亮防重复检查
    yellows = lay.get("yellows") or []
    line_boxes = lay.get("line_boxes") or []
    marks = lay.get("marks") or []

    # 3a. 若首句已作副标题，正文必须取消对首句的一切强调（[...], <...>, {...}）
    if sub_kind == "首句兜底" and matched_first_span is not None:
        r0, s0, e0 = matched_first_span
        span_cols = set(range(s0, e0))
        y_hit = (r0 < len(yellows)) and bool(set(yellows[r0]) & span_cols)
        m_hit = any(m["row"] == r0 and m["col"] in span_cols for m in marks)
        b_hit = False
        for lb in line_boxes:
            if lb["row"] == r0:
                if _clean(lb["text"]) and (_clean(lb["text"]) in sub_clean or sub_clean in _clean(lb["text"])):
                    b_hit = True
        if y_hit or b_hit or m_hit:
            kinds = [k for k, flag in (("金句变黄 [...]", y_hit), ("浅金选中 <...>", b_hit), ("小黄标 {...}", m_hit)) if flag]
            warnings.append(
                f"正文高亮与首句副标题重复：首句已作副标题，但正文仍对其使用了 {' / '.join(kinds)}，按规范应取消强调。"
            )
        else:
            notes.append("正文高亮防重复：首句作副标题且正文未重复强调。")

    # 3b. 若副标题与任何高亮片段重合（哪怕属于疑似金句档），也明确标出
    elif sub_clean:
        dup_hits = []
        for idx, ys in enumerate(yellows):
            if ys:
                y_str = "".join(lay["body"][idx]["glyphs"][k]["ch"] for k in sorted(ys))
                if sub_clean in _clean(y_str) or (len(_clean(y_str)) >= 4 and _clean(y_str) in sub_clean):
                    dup_hits.append(f"第{idx + 1}行金句黄字「{y_str}」")
        for lb in line_boxes:
            lb_c = _clean(lb["text"])
            if lb_c and (sub_clean in lb_c or (len(lb_c) >= 4 and lb_c in sub_clean)):
                dup_hits.append(f"第{lb['row'] + 1}行浅金选中「{lb['text']}」")
        if dup_hits:
            warnings.append(
                f"副标题与正文高亮内容重复（{'、'.join(dup_hits)}）：正文强调应与封面腰封错开，绝不重复。"
            )
        else:
            notes.append("正文高亮防重复：副标题与正文强调句无重复。")

    plat_title, plat_note = suggest_platform_title(title, sub, sub_kind)
    return dict(
        sub_kind=sub_kind,
        platform_title=plat_title,
        platform_note=plat_note,
        warnings=warnings,
        notes=notes,
    )
