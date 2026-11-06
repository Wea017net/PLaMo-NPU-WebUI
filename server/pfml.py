"""PLaMo 3 Translate の PFML3 プロンプト組み立て（chat_template.jinja と同じ規則）

先頭の <|plamo:bos|> も含めた文字列を返すので、トークナイズ時は
add_special_tokens=False にすること。
"""

from __future__ import annotations

import re

BOS = "<|plamo:bos|>"
STOP_TOKEN_IDS = (1, 16)  # <|plamo:bos|>, <|plamo:tag|>

_LANG_RE = re.compile(r"^(ja\(easy\)|[a-z]{2,3}(-[a-z]{4})?)$")


def _check_text(value: str, name: str, allow_empty: bool = False) -> None:
    if not isinstance(value, str):
        raise ValueError(f"{name} must be a string.")
    if not allow_empty and not value.strip():
        raise ValueError(f"{name} must not be empty.")
    if "<|plamo:" in value:
        raise ValueError(f"{name} must not contain reserved PFML tokens (<|plamo:...).")


def _check_lang(value: str, name: str) -> None:
    _check_text(value, name)
    if not _LANG_RE.match(value):
        raise ValueError(f"{name} must be a lowercase language code, e.g. en, ja, zh-hans, or ja(easy).")


def build_prompt(
    messages: list[dict],
    target_lang: str,
    source_lang: str | None = None,
    context: str | None = None,
    form: str | None = None,
    glossary: list[dict] | None = None,
) -> str:
    if not messages or len(messages) % 2 != 1:
        raise ValueError("Provide source/translation pairs followed by one user message.")
    for i, m in enumerate(messages):
        role = m.get("role")
        if role == "system":
            raise ValueError("System messages are not supported; use context for reference text.")
        if role != ("user" if i % 2 == 0 else "assistant"):
            raise ValueError("Alternate user source text and assistant translation; end with user.")
        _check_text(m.get("content"), "message content")
    _check_lang(target_lang, "target_lang")
    if source_lang is not None:
        _check_lang(source_lang, "source_lang")
    if context is not None:
        _check_text(context, "context", allow_empty=True)
    if form is not None and (form not in ("polite", "plain") or target_lang != "ja"):
        raise ValueError('form must be polite or plain and requires target_lang="ja".')
    if glossary is not None:
        for t in glossary:
            if not isinstance(t, dict) or set(t) != {"source", "target"}:
                raise ValueError("Each glossary entry must contain exactly source and target.")
            _check_text(t["source"], "glossary source")
            _check_text(t["target"], "glossary target")

    src_attr = f"<|plamo:key|>lang<|plamo:val|>{source_lang}" if source_lang is not None else ""
    out = [BOS, "<|plamo:tag|>dataset<|plamo:msg|>translation"]
    if context:
        out.append("<|plamo:tag|>context<|plamo:msg|>" + context)
    for m in messages[:-1]:
        if m["role"] == "user":
            out.append("<|plamo:tag|>input" + src_attr)
        else:
            out.append(f"<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>{target_lang}")
        out.append("<|plamo:msg|>" + m["content"])
    if glossary:
        out.append("<|plamo:tag|>glossary")
        for t in glossary:
            out.append(f"<|plamo:index|>{t['source']}<|plamo:item|>{t['target']}")
    out.append("<|plamo:tag|>input" + src_attr)
    out.append(f"<|plamo:msg|>{messages[-1]['content']}<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>{target_lang}")
    if form is not None:
        out.append(f"<|plamo:key|>form<|plamo:val|>{form}")
    out.append("<|plamo:msg|>")
    return "".join(out)
