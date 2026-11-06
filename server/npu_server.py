"""PLaMo 3 Translate を Intel NPU（OpenVINO GenAI）で動かす翻訳サーバー（Web UI 同梱）

  python -I npu_server.py [--model cw|g128|<IR フォルダ>] [--device NPU] [--port 8100]

- http://127.0.0.1:8100/                     … Web UI（<リポジトリ>/webui）
- POST /v1/chat/completions                  … OpenAI 互換（stream 対応、chat_template_kwargs で
                                                target_lang / source_lang / form / context / glossary）
- GET  /health  /props  /v1/models  /api/stats

llama-server と同じ形の timings（prompt_n, predicted_per_second など）を最後のチャンクに付ける。
NPU のパイプラインは 1 本なので同時に 1 リクエストだけ処理し、新しいリクエストが来たら
実行中の生成を打ち切って新しい方を優先する（ブラウザで入力し直したときの動き）。
"""

from __future__ import annotations

import argparse
import ctypes
import json
import os
import subprocess
import sys
import threading
import time
import traceback
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent          # リポジトリのルート
os.environ.setdefault("HF_HOME", str(BASE / ".cache" / "hf"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
import openvino as ov  # noqa: E402
import openvino_genai as ov_genai  # noqa: E402

from pfml import STOP_TOKEN_IDS, build_prompt  # noqa: E402

MODELS = {
    "cw": BASE / "models" / "plamo3-2b-ov-int4-cw",      # INT4 チャンネル単位（速い）
    "g128": BASE / "models" / "plamo3-2b-ov-int4-g128",  # INT4 グループ 128（元モデルに近い）
}
WEBUI_DIR = BASE / "webui"
CACHE_DIR = BASE / ".cache" / "ov"
NOWIN = getattr(subprocess, "CREATE_NO_WINDOW", 0)

# ---------------------------------------------------------------- 状態
_state = {"status": "loading", "error": None, "load_s": None}
_info: dict = {}          # model / device 情報（/props・/api/stats 用）
_metrics = {"prompt_tokens_total": 0, "tokens_predicted_total": 0, "requests_processing": 0,
            "prompt_tokens_seconds": 0.0, "predicted_tokens_seconds": 0.0}
_lock = threading.Lock()          # 状態・統計の保護
_gen_lock = threading.Lock()      # パイプラインは同時に 1 本
_current = None                   # 実行中のストリーマー（打ち切り用）
pipe = None
tok = None
ARGS = None


# ---------------------------------------------------------------- モデル読み込み
def load_model():
    global pipe, tok
    t0 = time.time()
    try:
        import gemma3_compat  # noqa: F401  （config.json の Gemma3 検証を緩める）
        from transformers import AutoTokenizer
        tok = AutoTokenizer.from_pretrained(ARGS.model_dir, trust_remote_code=True)
        props = {"CACHE_DIR": str(CACHE_DIR)}
        if ARGS.device == "NPU":
            props.update({"MAX_PROMPT_LEN": ARGS.max_prompt, "MIN_RESPONSE_LEN": ARGS.max_response})
        pipe = ov_genai.LLMPipeline(str(ARGS.model_dir), ARGS.device, **props)
        with _lock:
            _state.update(status="ok", load_s=time.time() - t0)
        print(f"model ready on {ARGS.device} in {time.time() - t0:.1f}s", flush=True)
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        with _lock:
            _state.update(status="error", error=str(e))


def detect_device():
    info = {"device": ARGS.device}
    try:
        core = ov.Core()
        info["name"] = core.get_property(ARGS.device, "FULL_DEVICE_NAME")
        try:
            luid = core.get_property(ARGS.device, "DEVICE_LUID")
            b = bytes(int(x) & 0xFF for x in (luid if not isinstance(luid, str) else bytes.fromhex(luid)))
            if len(b) == 8:
                low, high = int.from_bytes(b[:4], "little"), int.from_bytes(b[4:], "little")
                info["luid"] = f"luid_0x{high:08x}_0x{low:08x}"
        except Exception:  # noqa: BLE001
            pass
    except Exception:  # noqa: BLE001
        pass
    try:
        q = "*AI Boost*" if ARGS.device == "NPU" else "*Arc*"
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command",
             f"Get-CimInstance Win32_PnPSignedDriver | Where-Object DeviceName -like '{q}' | "
             "Select-Object -First 1 DeviceName,DriverVersion | ConvertTo-Json -Compress"],
            capture_output=True, text=True, encoding="utf-8", timeout=60, creationflags=NOWIN)
        d = json.loads(r.stdout or "{}")
        if d.get("DriverVersion"):
            info["driver"] = d["DriverVersion"]
    except Exception:  # noqa: BLE001
        pass
    with _lock:
        _info["device"] = info
    _start_poller(info.get("luid"))


# ---------------------------------------------------------------- メモリ・NPU 使用率（PowerShell 常駐）
# NPU も WDDM（MCDM）デバイスなので「GPU Engine」「GPU Process Memory」カウンターに出る。
# 自プロセスの値をアダプター LUID で絞り込んで集計する。
PS_LOOP = r"""
$ErrorActionPreference = 'SilentlyContinue'
$id = __PID__
$luid = '__LUID__'
while ($true) {
  $p = Get-Process -Id $id
  if (-not $p) { exit }
  $o = [ordered]@{ ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); pid = $id;
                   working_set = $p.WorkingSet64; private = $p.PrivateMemorySize64 }
  $f = if ($luid) { "pid_${id}_${luid}*" } else { "pid_${id}_*" }
  $s = (Get-Counter -ErrorAction SilentlyContinue -Counter @(
    "\GPU Process Memory($f)\Dedicated Usage",
    "\GPU Process Memory($f)\Shared Usage",
    "\GPU Engine($f)\Utilization Percentage")).CounterSamples
  $ded = 0; $sha = 0; $eng = @{}
  foreach ($c in $s) {
    if ($c.Path -like '*\dedicated usage') { $ded += $c.CookedValue }
    elseif ($c.Path -like '*\shared usage') { $sha += $c.CookedValue }
    elseif ($c.Path -match 'engtype_([^)]*)\)') {
      $k = $Matches[1]; if (-not $k) { $k = 'other' }
      $eng[$k] = [double]$eng[$k] + $c.CookedValue
    }
  }
  $o.gpu_dedicated = $ded
  $o.gpu_shared = $sha
  $o.gpu_util = if ($eng.Count) { [math]::Min(100, ($eng.Values | Measure-Object -Maximum).Maximum) } else { 0 }
  $o | ConvertTo-Json -Compress
}
"""
_proc_stats: dict = {}


def _start_poller(luid):
    def run():
        script = PS_LOOP.replace("__PID__", str(os.getpid())).replace("__LUID__", luid or "")
        while True:
            try:
                p = subprocess.Popen(["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
                                     stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
                                     encoding="utf-8", creationflags=NOWIN)
                for line in p.stdout:
                    line = line.strip()
                    if line.startswith("{"):
                        try:
                            d = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        with _lock:
                            _proc_stats.clear()
                            _proc_stats.update(d)
            except Exception:  # noqa: BLE001
                pass
            time.sleep(2)
    threading.Thread(target=run, daemon=True).start()


class _MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]


def system_memory():
    m = _MEMORYSTATUSEX()
    m.dwLength = ctypes.sizeof(m)
    ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
    return {"total": m.ullTotalPhys, "used": m.ullTotalPhys - m.ullAvailPhys}


# ---------------------------------------------------------------- 生成
class Streamer(ov_genai.StreamerBase):
    """トークンを受け取るたびに全体を decode し直し、増えた分だけ emit する。"""

    def __init__(self, emit):
        super().__init__()
        self.emit = emit
        self.ids: list[int] = []
        self.sent = ""
        self.cancel = False

    def write(self, token):
        if self.cancel:
            return ov_genai.StreamingStatus.CANCEL
        for t in (token if isinstance(token, (list, tuple)) else [token]):
            if int(t) not in STOP_TOKEN_IDS:
                self.ids.append(int(t))
        text = tok.decode(self.ids)
        if text.endswith("\ufffd") or not text.startswith(self.sent):
            return ov_genai.StreamingStatus.RUNNING   # マルチバイト文字の途中
        delta, self.sent = text[len(self.sent):], text
        if delta and self.emit:
            try:
                self.emit(delta)
            except OSError:                             # クライアントが切断
                self.cancel = True
                return ov_genai.StreamingStatus.CANCEL
        return ov_genai.StreamingStatus.RUNNING

    def end(self):
        pass

    def final_text(self):
        return tok.decode(self.ids)


class BadRequest(Exception):
    pass


def prepare(body: dict):
    kw = dict(body.get("chat_template_kwargs") or {})
    allowed = {"target_lang", "source_lang", "context", "form", "glossary"}
    kw = {k: v for k, v in kw.items() if k in allowed and v is not None}
    if "target_lang" not in kw:
        raise BadRequest('chat_template_kwargs.target_lang is required (e.g. "ja").')
    try:
        prompt = build_prompt(body.get("messages") or [], **kw)
    except ValueError as e:
        raise BadRequest(str(e)) from e
    ids = tok.encode(prompt, add_special_tokens=False)
    if ARGS.device == "NPU" and len(ids) > ARGS.max_prompt:
        raise BadRequest(f"The input is too long ({len(ids)} tokens). The NPU version accepts up to {ARGS.max_prompt} tokens. "
                         "Please split the text and translate it in parts.")
    max_new = int(body.get("max_tokens") or body.get("max_completion_tokens") or ARGS.max_response)
    if ARGS.device == "NPU":
        max_new = min(max_new, ARGS.max_response)
    return ids, max(1, max_new)


def generate(ids, max_new, emit):
    """生成して (text, timings, finish_reason) を返す。"""
    global _current
    streamer = Streamer(emit)
    prev = _current
    if prev is not None:
        prev.cancel = True            # 実行中の生成を打ち切る（新しい入力を優先）
    _current = streamer
    with _gen_lock:
        if streamer.cancel:
            return None
        with _lock:
            _metrics["requests_processing"] += 1
        try:
            inp = ov_genai.TokenizedInputs(ov.Tensor(np.array([ids], dtype=np.int64)),
                                           ov.Tensor(np.ones((1, len(ids)), dtype=np.int64)))
            cfg = ov_genai.GenerationConfig()
            cfg.max_new_tokens = max_new
            cfg.do_sample = False
            cfg.eos_token_id = STOP_TOKEN_IDS[0]
            cfg.stop_token_ids = set(STOP_TOKEN_IDS)
            res = pipe.generate(inp, cfg, streamer)
        finally:
            with _lock:
                _metrics["requests_processing"] -= 1
            if _current is streamer:
                _current = None
    pm = res.perf_metrics
    n_out = len(streamer.ids)
    ttft = pm.get_ttft().mean                       # ms（入力処理 + 1 トークン目）
    gen_ms = max(pm.get_generate_duration().mean - ttft, 1e-6)
    pred_ps = (n_out - 1) / (gen_ms / 1000) if n_out > 1 else 0.0
    timings = {
        "prompt_n": len(ids), "prompt_ms": ttft,
        "prompt_per_second": len(ids) / (ttft / 1000) if ttft else 0.0,
        "predicted_n": n_out, "predicted_ms": gen_ms, "predicted_per_second": pred_ps,
    }
    with _lock:
        _metrics["prompt_tokens_total"] += len(ids)
        _metrics["tokens_predicted_total"] += n_out
        _metrics["prompt_tokens_seconds"] = timings["prompt_per_second"]
        _metrics["predicted_tokens_seconds"] = pred_ps
    finish = "length" if n_out >= max_new else "stop"
    if streamer.cancel:
        finish = "cancelled"
    return streamer.final_text(), timings, finish


# ---------------------------------------------------------------- HTTP
def props():
    with _lock:
        st, dev = dict(_state), dict(_info.get("device", {}))
    return {
        "model_path": str(ARGS.model_dir), "model_alias": "plamo-3-translate",
        "model_ftype": ARGS.quant_label, "device": dev, "status": st["status"],
        "load_seconds": st["load_s"], "error": st["error"],
        "max_prompt_tokens": ARGS.max_prompt, "max_response_tokens": ARGS.max_response,
        "default_generation_settings": {"n_ctx": ARGS.max_prompt + ARGS.max_response},
        "total_slots": 1,
    }


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    # Windows はレジストリ次第で .js が text/plain になり、ES モジュールが読み込めないため明示する
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".mjs": "text/javascript",
                      ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json",
                      ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain; charset=utf-8"}

    # -- helpers
    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, code, msg, typ="invalid_request_error"):
        self._json(code, {"error": {"code": code, "message": msg, "type": typ}})

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, *args):
        pass

    # -- routes
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/health":
            with _lock:
                st = dict(_state)
            if st["status"] == "ok":
                return self._json(200, {"status": "ok"})
            if st["status"] == "loading":
                return self._error(503, "Loading model", "unavailable_error")
            return self._error(500, st["error"] or "load failed", "server_error")
        if path == "/props":
            return self._json(200, props())
        if path == "/v1/models":
            return self._json(200, {"object": "list", "data": [
                {"id": "plamo-3-translate", "object": "model", "owned_by": "pfnet"}]})
        if path == "/api/stats":
            return self._json(200, self._stats())
        super().do_GET()

    def _stats(self):
        p = props()
        with _lock:
            proc, metrics = dict(_proc_stats), dict(_metrics)
        dev = p["device"]
        return {
            "process": proc,
            "system": system_memory(),
            "gpu": {"device": dev.get("device"), "name": dev.get("name"), "driver": dev.get("driver"),
                    "kind": "NPU" if ARGS.device == "NPU" else ARGS.device},
            "llama": {"online": p["status"] == "ok", "loading": p["status"] == "loading",
                      "error": p["error"], "model": Path(p["model_path"]).name, "ftype": p["model_ftype"],
                      "n_ctx": p["default_generation_settings"]["n_ctx"], "slots": 1,
                      "load_seconds": p["load_seconds"], "metrics": metrics},
        }

    def do_POST(self):
        path = self.path.split("?")[0]
        if path not in ("/v1/chat/completions", "/chat/completions"):
            return self._error(404, "Not found")
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:  # noqa: BLE001
            return self._error(400, "Invalid JSON body.")
        with _lock:
            status = _state["status"]
        if status != "ok":
            return self._error(503, "The model is still loading." if status == "loading" else _state["error"],
                               "unavailable_error")
        try:
            ids, max_new = prepare(body)
        except BadRequest as e:
            return self._error(400, str(e))

        cid = f"chatcmpl-{int(time.time() * 1000)}"
        created = int(time.time())
        base = {"id": cid, "created": created, "model": "plamo-3-translate"}

        if not body.get("stream"):
            try:
                r = generate(ids, max_new, None)
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                return self._error(500, str(e), "server_error")
            if r is None:
                return self._error(409, "Superseded by a newer request.", "cancelled")
            text, timings, finish = r
            return self._json(200, {**base, "object": "chat.completion", "choices": [
                {"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": finish}],
                "usage": {"prompt_tokens": timings["prompt_n"], "completion_tokens": timings["predicted_n"],
                          "total_tokens": timings["prompt_n"] + timings["predicted_n"]},
                "timings": timings})

        # ---- SSE（chunked）
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Transfer-Encoding", "chunked")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

        def send(obj):
            data = ("data: " + (obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False)) + "\n\n").encode()
            self.wfile.write(f"{len(data):X}\r\n".encode() + data + b"\r\n")
            self.wfile.flush()

        def chunk(delta=None, finish=None, **extra):
            return {**base, "object": "chat.completion.chunk",
                    "choices": [{"index": 0, "delta": delta or {}, "finish_reason": finish}], **extra}

        try:
            send(chunk({"role": "assistant", "content": ""}))
            r = generate(ids, max_new, lambda d: send(chunk({"content": d})))
            if r is not None:
                _, timings, finish = r
                if finish != "cancelled":
                    send(chunk(finish=finish, timings=timings,
                               usage={"prompt_tokens": timings["prompt_n"],
                                      "completion_tokens": timings["predicted_n"],
                                      "total_tokens": timings["prompt_n"] + timings["predicted_n"]}))
                    send("[DONE]")
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()
        except OSError:
            pass                       # クライアントが切断（新しい入力で置き換えなど）
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            try:
                send({"error": {"code": 500, "message": str(e), "type": "server_error"}})
                self.wfile.write(b"0\r\n\r\n")
            except OSError:
                pass


def main():
    global ARGS
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="cw", help="cw (default, faster) / g128 (closer to the original) / path to an IR folder")
    ap.add_argument("--device", default="NPU", help="NPU (default) / GPU / CPU")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8100)
    ap.add_argument("--max-prompt", type=int, default=1024, help="maximum input tokens on the NPU")
    ap.add_argument("--max-response", type=int, default=1024, help="maximum output tokens on the NPU")
    ARGS = ap.parse_args()
    ARGS.device = ARGS.device.upper()
    ARGS.model_dir = MODELS.get(ARGS.model, Path(ARGS.model))
    ARGS.quant_label = {"cw": "INT4 (sym, per-channel)", "g128": "INT4 (sym, group 128)"}.get(ARGS.model, "OpenVINO IR")
    if not (ARGS.model_dir / "openvino_model.xml").exists():
        sys.exit(f"Model not found: {ARGS.model_dir}")

    threading.Thread(target=detect_device, daemon=True).start()
    threading.Thread(target=load_model, daemon=True).start()
    httpd = ThreadingHTTPServer((ARGS.host, ARGS.port), partial(Handler, directory=str(WEBUI_DIR)))
    httpd.daemon_threads = True
    print(f"PLaMo NPU server: http://{ARGS.host}:{ARGS.port}/  (model={ARGS.model_dir.name}, device={ARGS.device})",
          flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
