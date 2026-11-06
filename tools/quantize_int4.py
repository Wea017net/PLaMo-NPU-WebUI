"""OpenVINO IR の重みを NNCF で INT4 に圧縮する（データ不要の重み圧縮）。

NPU 推奨: INT4 対称・チャンネル単位（group_size=-1）。
埋め込み・lm_head などは NNCF の既定どおり INT8 で残る。

  python -I quantize_int4.py <入力フォルダ> <出力フォルダ> [--group-size N] [--ratio R]
"""

import argparse
import shutil
import time
from pathlib import Path

import nncf
import openvino as ov


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("dst", type=Path)
    ap.add_argument("--group-size", type=int, default=-1)
    ap.add_argument("--ratio", type=float, default=1.0)
    args = ap.parse_args()

    t0 = time.time()
    core = ov.Core()
    model = core.read_model(args.src / "openvino_model.xml")
    model = nncf.compress_weights(
        model,
        mode=nncf.CompressWeightsMode.INT4_SYM,
        group_size=args.group_size,
        ratio=args.ratio,
    )
    args.dst.mkdir(parents=True, exist_ok=True)
    ov.save_model(model, args.dst / "openvino_model.xml", compress_to_fp16=True)
    for f in args.src.iterdir():
        if f.name not in ("openvino_model.xml", "openvino_model.bin") and f.is_file():
            shutil.copy2(f, args.dst / f.name)
    print(f"saved {args.dst} in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
