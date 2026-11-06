"""Download PLaMo 3 Translate 2B and build the NPU-ready OpenVINO models.

  python -I tools/build_model.py [--variants cw g128] [--keep-intermediate]

Steps (each step is skipped when its output already exists, so the script can be re-run):
  1. download   pfnet/plamo-3-translate-2b                -> hf/plamo-3-translate-2b
  2. convert    PLaMo 3 -> Gemma 3 layout (weights only)  -> models/plamo3-2b-gemma3
  3. export     OpenVINO IR (stateful, BF16)              -> models/plamo3-2b-ov-bf16
  4. quantize   INT4 weight compression with NNCF         -> models/plamo3-2b-ov-int4-cw / -g128
  5. clean up   delete 1-3 (about 17 GB) unless --keep-intermediate

The model is licensed under the PLaMo Community License (https://plamo.preferredai.jp/info/plamo-community-license-en).
By downloading it you agree to that license. The converted models are "Derived Models" under that license.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
REPO_ID = "pfnet/plamo-3-translate-2b"
HF_DIR = ROOT / "hf" / "plamo-3-translate-2b"
GEMMA_DIR = ROOT / "models" / "plamo3-2b-gemma3"
BF16_DIR = ROOT / "models" / "plamo3-2b-ov-bf16"
VARIANTS = {
    "cw": (ROOT / "models" / "plamo3-2b-ov-int4-cw", ["--group-size", "-1"]),      # per-channel (fastest on NPU)
    "g128": (ROOT / "models" / "plamo3-2b-ov-int4-g128", ["--group-size", "128"]),  # group 128 (closest to BF16)
}


def step(title: str) -> None:
    print(f"\n=== {title}", flush=True)


def run(script: str, *args: str) -> None:
    cmd = [sys.executable, "-I", str(TOOLS / script), *map(str, args)]
    print("  $", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, env=os.environ.copy())   # separate process: frees memory between steps


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--variants", nargs="+", choices=sorted(VARIANTS), default=["cw", "g128"])
    ap.add_argument("--keep-intermediate", action="store_true", help="keep hf/, the Gemma 3 copy and the BF16 IR")
    args = ap.parse_args()

    os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "hf"))
    t0 = time.time()
    todo = [(name, *VARIANTS[name]) for name in args.variants]
    if all((d / "openvino_model.xml").exists() for _, d, _ in todo):
        print("All requested models already exist:", ", ".join(str(d) for _, d, _ in todo))
        return

    step(f"1/5 download {REPO_ID}")
    if (HF_DIR / "model.safetensors.index.json").exists():
        print("  already downloaded")
    else:
        from huggingface_hub import snapshot_download
        snapshot_download(REPO_ID, local_dir=str(HF_DIR))

    step("2/5 convert PLaMo 3 -> Gemma 3 layout")
    if (GEMMA_DIR / "model.safetensors").exists():
        print("  already converted")
    else:
        run("convert_plamo3_to_gemma3.py", HF_DIR, GEMMA_DIR)

    step("3/5 export OpenVINO IR (BF16)")
    if (BF16_DIR / "openvino_model.xml").exists():
        print("  already exported")
    else:
        run("export_openvino.py", GEMMA_DIR, BF16_DIR, "--tokenizer-dir", HF_DIR)
    # optimum may write a generic tokenizer.json; the server uses the PLaMo tokenizer instead
    (BF16_DIR / "tokenizer.json").unlink(missing_ok=True)

    step("4/5 INT4 weight compression")
    for name, dst, extra in todo:
        if (dst / "openvino_model.xml").exists():
            print(f"  {name}: already exists")
            continue
        run("quantize_int4.py", BF16_DIR, dst, *extra)

    step("5/5 clean up")
    if args.keep_intermediate:
        print("  kept intermediate files (--keep-intermediate)")
    else:
        for d in (HF_DIR, GEMMA_DIR, BF16_DIR):
            if d.exists():
                shutil.rmtree(d)
                print(f"  removed {d}")
        if (ROOT / "hf").exists() and not any((ROOT / "hf").iterdir()):
            (ROOT / "hf").rmdir()

    print(f"\nDone in {(time.time() - t0) / 60:.1f} min. Start the server with start-plamo-npu.bat", flush=True)


if __name__ == "__main__":
    main()
