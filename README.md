# PLaMo NPU WebUI

**English** | [日本語](README.ja.md)

> [!IMPORTANT]
> This is 100% Vibe-coded repository.

Run [PLaMo 3 Translate 2B](https://huggingface.co/pfnet/plamo-3-translate-2b) by Preferred Networks on the
**Intel NPU (Intel® AI Boost)** of Intel Core Ultra PCs — fully offline, with a browser-based translation UI.

> [!IMPORTANT]
> This is an **unofficial, third-party** project. It is not affiliated with, sponsored by, or endorsed by
> Preferred Networks, Inc. or Intel Corporation. **Built with PLaMo.**
> The model is **not** included in this repository and is licensed separately under the
> [PLaMo Community License](https://plamo.preferredai.jp/info/plamo-community-license-en).

## Features

- **Runs on the NPU** with [OpenVINO GenAI](https://github.com/openvinotoolkit/openvino.genai). The GPU and most of the CPU stay free.
- **Offline**: after setup, nothing is sent to or loaded from the internet (no web fonts, no CDNs).
- **OpenAI-compatible API** (`/v1/chat/completions`, streaming), using the same request format as llama.cpp's `llama-server`.
- **All 53 languages** supported by PLaMo 3 Translate can be picked in the web UI, including Simplified and Traditional Chinese.
- **Japanese style**: when translating into Japanese, choose polite (です・ます) or plain (だ・である) style, or leave it to the model.

## How it works

OpenVINO does not support the PLaMo 3 architecture directly. However, PLaMo 3 is structurally almost identical to
**Gemma 3** (sandwich norms, QK-norm, interleaved sliding-window / global attention, per-layer RoPE). The remaining
differences can be folded into the weights:

| PLaMo 3 | Gemma 3 | Conversion |
|---|---|---|
| RMSNorm with `(offset + w)` (offsets 1.0 / 0.2 / 5^-1.5) | `(1 + w)` | `w' = w + offset - 1` |
| No embedding scaling | embeddings × √hidden_size | `E' = E / √hidden_size` |
| SwiGLU (SiLU) | GeGLU | `hidden_activation = "silu"` |
| Fused `qkv_proj` / `gate_up_proj` | separate projections | split the matrices |

`tools/convert_plamo3_to_gemma3.py` rewrites the checkpoint, `tools/verify_conversion.py` checks that the original and
converted models produce the same logits and greedy outputs (CPU, FP32), and the result is exported to a stateful
OpenVINO IR and compressed to INT4 with NNCF. The server (`server/npu_server.py`) runs it with `LLMPipeline` on the NPU
and uses PLaMo's own tokenizer in Python.

## Requirements

- Windows 11
- Intel Core Ultra processor with an NPU and the Intel NPU driver
  (tested: Core Ultra 7 258V / Lunar Lake, NPU driver 32.0.100.5540, 32 GB RAM)
- Python 3.10 (tested with 3.10.6)
- Disk: about 25 GB free during setup (about 4 GB after cleanup)
- Internet access during setup only (Python packages and the model from Hugging Face)

## Setup

```bat
git clone https://github.com/Wea017net/PLaMo-NPU-WebUI.git
cd PLaMo-NPU-WebUI
setup.bat
```

`setup.bat` creates `venv\`, installs [requirements.txt](requirements.txt), then runs `tools\build_model.py`, which:

1. downloads `pfnet/plamo-3-translate-2b` to `hf\` — **by doing this you agree to the PLaMo Community License**
2. converts it to the Gemma 3 layout
3. exports a BF16 OpenVINO IR
4. creates the INT4 models in `models\` (`plamo3-2b-ov-int4-cw` and `plamo3-2b-ov-int4-g128`)
5. deletes the intermediate files (pass `--keep-intermediate` to keep them)

Options: `setup.bat -Variants cw` (build only one model), `setup.bat -SkipModel` (packages only).

## Usage

```bat
start-plamo-npu.bat
```

The browser opens <http://127.0.0.1:8100/>. The first start compiles the model for the NPU (about a minute);
later starts use the cache in `.cache\ov` and take a few seconds. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> or close the
window to stop.

| Option | Description |
|---|---|
| `-Model cw` (default) | INT4, per-channel. Fastest on the NPU. |
| `-Model g128` | INT4, group size 128. Translations closest to the original BF16 model. |
| `-Port 8100` | Port for both the UI and the API. |
| `-NoBrowser` | Do not open the browser. |

### Measured performance (Core Ultra 7 258V)

| Model | Generation | Time to first token | Notes |
|---|---|---|---|
| `int4-cw` | about 20–24 tok/s | about 0.5–0.6 s | slight wording differences from BF16 |
| `int4-g128` | about 16–18 tok/s | about 0.95 s | matches BF16 in our tests |

### API

```bash
curl http://127.0.0.1:8100/v1/chat/completions -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Hello, world!\"}],\"chat_template_kwargs\":{\"target_lang\":\"ja\"}}"
```

`chat_template_kwargs` accepts `target_lang` (required), `source_lang`, `form` (`polite`/`plain`, Japanese only),
`context` and `glossary` (`[{"source": "...", "target": "..."}]`), as in the model's chat template.
Set `"stream": true` for server-sent events; the last chunk includes llama.cpp-style `timings`.
Other endpoints: `GET /health`, `/props`, `/v1/models`, `/api/stats`.

## Limitations

- The NPU needs fixed sizes: input up to **1,024 tokens** and output up to **1,024 tokens** by default
  (`--max-prompt` / `--max-response` in `server/npu_server.py`; changing them triggers a recompile).
  Split long texts.
- One request at a time. A new request cancels the one in progress (this is what the UI needs when you keep typing).
- Tested only on the hardware listed above.

## Project layout

```
server/   npu_server.py (API + UI server), pfml.py (prompt format), gemma3_compat.py
tools/    build_model.py, convert / export / quantize scripts, verification and benchmark scripts
webui/    index.html, css/, js/ (ES modules), assets/ (icon font, favicon)
```

`models/`, `hf/`, `venv/` and `.cache/` are created locally and are ignored by git.

## License

- **This repository's code**: [Apache License 2.0](LICENSE). Copyright 2026 Wea017net.
- **PLaMo 3 Translate** (not included): [PLaMo Community License](https://plamo.preferredai.jp/info/plamo-community-license-en)
  by Preferred Networks, Inc. In short (read the license itself for the binding terms):
  - Personal and academic use is free. **Commercial use requires prior registration** with PFN, and is limited to
    organizations with annual revenue of 1 billion yen or less; larger organizations need a separate agreement.
  - When you provide the model or derived models to others, include a copy of the license, display
    **"Built with PLaMo"**, and include "PLaMo" in the model name.
  - When you publish translations, state that they were generated by the model.
  - Do not use the output as the sole basis for legal, medical, financial or other important decisions.
- **Third-party components**: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [NOTICE](NOTICE).

## Disclaimer

Translations are generated by an AI model and may be inaccurate. This software is provided "as is", without warranty
of any kind. Use it at your own risk.

## Acknowledgements

- [Preferred Networks](https://www.preferred.jp/) for releasing PLaMo 3 Translate
- [OpenVINO](https://github.com/openvinotoolkit/openvino) and [Optimum Intel](https://github.com/huggingface/optimum-intel)
- [Material Symbols](https://fonts.google.com/icons) by Google
