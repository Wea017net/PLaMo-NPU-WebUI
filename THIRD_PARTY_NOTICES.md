# Third-party notices

This repository contains the source code of PLaMo NPU WebUI (Apache License 2.0, see [LICENSE](LICENSE))
and **one** bundled third-party file: the Material Symbols icon font.
Everything else listed below is downloaded or installed by the user and is **not** redistributed here.

## Bundled

| Component | License | Copyright | Location |
|---|---|---|---|
| [Material Symbols](https://github.com/google/material-design-icons) (Outlined, variable font) | Apache License 2.0 | Google LLC | `webui/assets/fonts/MaterialSymbolsOutlined.woff2`, license text in `webui/assets/fonts/LICENSE-MaterialSymbols.txt` |

## Model (not bundled)

| Component | License | Copyright |
|---|---|---|
| [PLaMo 3 Translate 2B](https://huggingface.co/pfnet/plamo-3-translate-2b) (`pfnet/plamo-3-translate-2b`) — weights, tokenizer and model code | [PLaMo Community License](https://plamo.preferredai.jp/info/plamo-community-license-en) | Preferred Networks, Inc. |

**Built with PLaMo.** `tools/build_model.py` downloads the model from Hugging Face and converts it on the user's PC.
The converted OpenVINO models (`models/plamo3-2b-ov-int4-*`) are *Derived Models* under the PLaMo Community License;
their names contain "PLaMo" as the license requires. Do not commit or redistribute them without following Article 4
of the license (provide a copy of the license, display "Built with PLaMo", etc.).

`server/pfml.py` re-implements the prompt format of the model's `chat_template.jinja` so that prompts are byte-identical
to the official template.

## Fonts used from the system (not bundled)

| Component | License | Copyright |
|---|---|---|
| Noto Sans, Noto Sans JP / SC / KR | SIL Open Font License 1.1 | Google LLC |

The UI only refers to these fonts by name. If they are not installed, the system's sans-serif font is used.
No font files are downloaded.

## Python packages (installed with pip, not bundled)

| Package | License |
|---|---|
| [OpenVINO](https://github.com/openvinotoolkit/openvino), [OpenVINO GenAI](https://github.com/openvinotoolkit/openvino.genai), [NNCF](https://github.com/openvinotoolkit/nncf) | Apache License 2.0 |
| [Optimum](https://github.com/huggingface/optimum), [Optimum Intel](https://github.com/huggingface/optimum-intel), [Transformers](https://github.com/huggingface/transformers), [huggingface_hub](https://github.com/huggingface/huggingface_hub), [safetensors](https://github.com/huggingface/safetensors) | Apache License 2.0 |
| [PyTorch](https://github.com/pytorch/pytorch) | BSD-3-Clause |
| [NumPy](https://github.com/numpy/numpy) | BSD-3-Clause |
| [Numba](https://github.com/numba/numba) | BSD-2-Clause |

See each project for the full license text. Versions are pinned in [requirements.txt](requirements.txt).

## Trademarks

PLaMo, Preferred Networks, Intel, Intel Core, OpenVINO and other names used in this repository may be trademarks of
their respective owners. They are used only to describe compatibility. This project is not affiliated with, sponsored by,
or endorsed by any of them.
