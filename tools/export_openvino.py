"""Gemma 3 形式に変換した PLaMo 3 を OpenVINO IR（重み INT4）に書き出す。

NPU 向けの推奨設定（INT4 対称・チャンネル単位）を既定にしている。

  python -I export_openvino.py <Gemma3 形式フォルダ> <出力フォルダ> [--group-size N] [--ratio R]
"""

import argparse
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))
import gemma3_compat  # noqa: E402,F401  （Gemma3TextConfig の検証を緩める）

import transformers  # noqa: E402
from optimum.exporters.openvino import main_export  # noqa: E402
from optimum.exporters.openvino.model_configs import Gemma3TextOpenVINOConfig  # noqa: E402
from optimum.intel import OVConfig, OVWeightQuantizationConfig  # noqa: E402

# optimum-intel 2.2 の Gemma 系エクスポート設定は transformers <= 5.0 を上限にしている（検証範囲の上限）。
# このプロセス内だけ上限を現在の版に引き上げる。結果は verify で元モデルと照合する。
Gemma3TextOpenVINOConfig.MAX_TRANSFORMERS_VERSION = transformers.__version__


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("dst", type=Path)
    ap.add_argument("--group-size", type=int, default=-1, help="-1 = チャンネル単位（NPU 推奨）")
    ap.add_argument("--ratio", type=float, default=1.0)
    ap.add_argument("--tokenizer-dir", type=Path, default=ROOT / "hf" / "plamo-3-translate-2b",
                    help="PLaMo の元モデルフォルダ（トークナイザーのコピー元）")
    args = ap.parse_args()

    q = OVWeightQuantizationConfig(bits=4, sym=True, group_size=args.group_size, ratio=args.ratio)
    t0 = time.time()
    main_export(
        model_name_or_path=str(args.src),
        output=args.dst,
        task="text-generation-with-past",
        framework="pt",
        ov_config=OVConfig(quantization_config=q),
        stateful=True,
        convert_tokenizer=False,
        library_name="transformers",
        local_files_only=True,
    )
    # 推論側で使うトークナイザー（PLaMo 独自）も同じフォルダに置く
    tok_src = args.tokenizer_dir
    for name in ("tokenization_plamo.py", "tokenizer.jsonl", "tokenizer_config.json",
                 "special_tokens_map.json", "chat_template.jinja"):
        shutil.copy2(tok_src / name, args.dst / name)
    print(f"exported to {args.dst} in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
