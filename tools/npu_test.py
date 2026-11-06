"""OpenVINO GenAI で PLaMo 3（Gemma 3 形式 IR）を各デバイスで実行し、訳文と速度を比べる。

  python -I npu_test.py <IR フォルダ> NPU [GPU CPU ...]

トークナイザーは PLaMo 独自のもの（Python）を使い、GenAI にはトークン ID を渡す。
"""

import sys
import time
from pathlib import Path

import numpy as np
import openvino as ov
import openvino_genai as ov_genai

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))   # pfml.py / gemma3_compat.py
from pfml import STOP_TOKEN_IDS, build_prompt  # noqa: E402

CASES = [
    dict(messages=[{"role": "user", "content": "The meeting has been rescheduled to next Monday because several members are attending an overseas conference."}], target_lang="ja"),
    dict(messages=[{"role": "user", "content": "PLaMo 3 Translateは53言語の翻訳に対応しています。"}], target_lang="en"),
    dict(messages=[{"role": "user", "content": "This system is convenient."}], target_lang="ja", form="plain"),
    dict(messages=[{"role": "user", "content": "Large language models are increasingly being deployed on personal devices, which raises new questions about privacy, energy efficiency, and the trade-offs between model size and translation quality."}], target_lang="ja"),
]
CACHE_DIR = str(ROOT / ".cache" / "ov")


def load_tokenizer(model_dir: Path):
    import gemma3_compat  # noqa: F401  （config.json の Gemma3 検証を緩める）
    from transformers import AutoTokenizer
    return AutoTokenizer.from_pretrained(model_dir, trust_remote_code=True)


def make_pipe(model_dir: Path, device: str):
    props = {"CACHE_DIR": CACHE_DIR}
    if device == "NPU":
        props.update({"MAX_PROMPT_LEN": 1024, "MIN_RESPONSE_LEN": 512})
    t0 = time.time()
    pipe = ov_genai.LLMPipeline(str(model_dir), device, **props)
    return pipe, time.time() - t0


def run(pipe, tok, case):
    ids = tok.encode(build_prompt(**case), add_special_tokens=False)
    inp = ov_genai.TokenizedInputs(
        ov.Tensor(np.array([ids], dtype=np.int64)), ov.Tensor(np.ones((1, len(ids)), dtype=np.int64))
    )
    cfg = ov_genai.GenerationConfig()
    cfg.max_new_tokens = 256
    cfg.do_sample = False
    cfg.eos_token_id = STOP_TOKEN_IDS[0]
    cfg.stop_token_ids = set(STOP_TOKEN_IDS)
    res = pipe.generate(inp, cfg)
    out = [t for t in res.tokens[0] if t not in STOP_TOKEN_IDS]
    pm = res.perf_metrics
    return tok.decode(out), len(ids), len(out), pm.get_ttft().mean, pm.get_throughput().mean


def main():
    model_dir = Path(sys.argv[1])
    tok = load_tokenizer(model_dir)
    for device in sys.argv[2:]:
        try:
            pipe, load_s = make_pipe(model_dir, device)
        except Exception as e:  # noqa: BLE001
            print(f"=== {device}: 読み込み失敗: {e}", flush=True)
            continue
        print(f"=== {device}: 読み込み {load_s:.1f}s", flush=True)
        for i, case in enumerate(CASES):
            try:
                text, n_in, n_out, ttft, tps = run(pipe, tok, case)
                print(f"[{device}] case{i} in={n_in} out={n_out} TTFT={ttft:.0f}ms {tps:.1f}tok/s → {text}", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"[{device}] case{i} 失敗: {e}", flush=True)
        del pipe


if __name__ == "__main__":
    main()
