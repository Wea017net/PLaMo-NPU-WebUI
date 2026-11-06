"""変換前（PLaMo 3）と変換後（Gemma 3）の出力が一致するかを CPU / fp32 で検証する。

  python -I verify_conversion.py plamo  <PLaMo フォルダ>  <結果.pt>
  python -I verify_conversion.py gemma3 <Gemma3 フォルダ> <結果.pt> <PLaMo の結果.pt>

メモリ節約のため、片方ずつ別プロセスで実行する。
"""

import os
import sys
import time
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))   # pfml.py / gemma3_compat.py
from pfml import STOP_TOKEN_IDS, build_prompt  # noqa: E402

# 元モデル（Hugging Face からダウンロードしたフォルダ）。環境変数 PLAMO_HF_DIR で変更できる
TOKENIZER_DIR = Path(os.environ.get("PLAMO_HF_DIR", ROOT / "hf" / "plamo-3-translate-2b"))

CASES = [
    dict(messages=[{"role": "user", "content": "The meeting has been rescheduled to next Monday because several members are attending an overseas conference."}], target_lang="ja"),
    dict(messages=[{"role": "user", "content": "PLaMo 3 Translateは53言語の翻訳に対応しています。"}], target_lang="en"),
    dict(messages=[{"role": "user", "content": "This system is convenient."}], target_lang="ja", form="plain"),
]
MAX_NEW = 48


def greedy(model, ids):
    out = model.generate(
        ids, attention_mask=torch.ones_like(ids), max_new_tokens=MAX_NEW, do_sample=False,
        eos_token_id=list(STOP_TOKEN_IDS), pad_token_id=3,
    )
    return out[0, ids.shape[1]:].tolist()


def main():
    mode, model_dir, out_path = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    from transformers import AutoModelForCausalLM, AutoTokenizer
    import gemma3_compat  # noqa: F401  (Gemma3TextConfig の過剰な検証を無効化)

    tok = AutoTokenizer.from_pretrained(TOKENIZER_DIR, trust_remote_code=True)
    t0 = time.time()
    model = AutoModelForCausalLM.from_pretrained(
        model_dir, dtype=torch.float32, trust_remote_code=(mode == "plamo")
    ).eval()
    print(f"[{mode}] loaded {type(model).__name__} in {time.time() - t0:.1f}s", flush=True)

    results = []
    with torch.inference_mode():
        for case in CASES:
            prompt = build_prompt(**case)
            ids = torch.tensor([tok.encode(prompt, add_special_tokens=False)])
            logits = model(ids, attention_mask=torch.ones_like(ids)).logits[0].float()
            gen = greedy(model, ids)
            text = tok.decode([t for t in gen if t not in STOP_TOKEN_IDS])
            results.append({"ids": ids[0].tolist(), "logits": logits, "gen": gen, "text": text})
            print(f"[{mode}] {len(ids[0])} tok → {text!r}", flush=True)
    torch.save(results, out_path)

    if mode == "gemma3":
        ref = torch.load(sys.argv[4])
        ok = True
        for i, (a, b) in enumerate(zip(ref, results)):
            assert a["ids"] == b["ids"]
            diff = (a["logits"] - b["logits"]).abs()
            top_a, top_b = a["logits"].argmax(-1), b["logits"].argmax(-1)
            agree = (top_a == top_b).float().mean().item()
            same_gen = a["gen"] == b["gen"]
            ok &= same_gen and agree == 1.0
            print(
                f"case {i}: max|Δlogit|={diff.max().item():.2e} mean|Δlogit|={diff.mean().item():.2e} "
                f"top1一致={agree*100:.1f}% 生成一致={same_gen}",
                flush=True,
            )
        print("RESULT:", "一致" if ok else "不一致あり", flush=True)


if __name__ == "__main__":
    main()
