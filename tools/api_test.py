"""NPU サーバーの API を確かめる。  python -I api_test.py [port]"""
import json
import sys
import time
import urllib.error
import urllib.request

BASE = f"http://127.0.0.1:{sys.argv[1] if len(sys.argv) > 1 else 8100}"


def post(body, stream=False):
    req = urllib.request.Request(BASE + "/v1/chat/completions", json.dumps({**body, "stream": stream}).encode(),
                                 {"Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=120)


def chat(text, **kw):
    return {"messages": [{"role": "user", "content": text}], "chat_template_kwargs": kw, "temperature": 0}


# 1) 非ストリーム
t0 = time.time()
r = json.load(post(chat("The meeting has been rescheduled to next Monday because several members are attending an overseas conference.", target_lang="ja")))
print("[non-stream]", r["choices"][0]["message"]["content"], "|", r["choices"][0]["finish_reason"],
      f"| {r['timings']['predicted_per_second']:.1f} tok/s, TTFT {r['timings']['prompt_ms']:.0f}ms, {time.time() - t0:.1f}s")

# 2) ストリーム（日本語→英語、source_lang 指定）
t0 = time.time()
first, parts, timings = None, [], None
with post(chat("PLaMo 3 Translateは53言語の翻訳に対応しています。", target_lang="en", source_lang="ja"), stream=True) as res:
    for line in res:
        line = line.decode().strip()
        if not line.startswith("data: ") or line == "data: [DONE]":
            continue
        j = json.loads(line[6:])
        d = j["choices"][0]["delta"].get("content")
        if d:
            first = first or time.time() - t0
            parts.append(d)
        timings = j.get("timings") or timings
print("[stream]", "".join(parts), f"| chunks={len(parts)} first={first:.2f}s",
      f"| {timings['predicted_per_second']:.1f} tok/s in={timings['prompt_n']} out={timings['predicted_n']}")

# 3) 常体指定・複数文
r = json.load(post(chat("Large language models are increasingly being deployed on personal devices, which raises new questions about privacy, energy efficiency, and the trade-offs between model size and translation quality.", target_lang="ja", form="plain")))
print("[plain]", r["choices"][0]["message"]["content"], f"| {r['timings']['predicted_per_second']:.1f} tok/s")

# 4) エラー（target_lang なし）
try:
    post({"messages": [{"role": "user", "content": "hi"}]})
except urllib.error.HTTPError as e:
    print("[error]", e.code, json.load(e)["error"]["message"])

# 5) 統計
s = json.load(urllib.request.urlopen(BASE + "/api/stats"))
p = s["process"]
print("[stats] ws=%.2fGB npu_shared=%.2fGB npu_util=%s metrics=%s" % (
    p.get("working_set", 0) / 2**30, p.get("gpu_shared", 0) / 2**30, p.get("gpu_util"), s["llama"]["metrics"]))
