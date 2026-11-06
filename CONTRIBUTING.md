# Contributing to PLaMo NPU WebUI

Thank you for your interest in this project! Bug reports, compatibility reports, feature ideas and pull requests are
all welcome. You can write in **English or Japanese** (日本語でも大丈夫です — see [日本語](#日本語) below).

This is an unofficial, community project. It is not affiliated with Preferred Networks or Intel, so please do not
contact them about problems with this tool.

## Ways to contribute

| What | Where |
| --- | --- |
| Something does not work as expected | [Bug Report / バグ報告](../../issues/new?template=bug_report.yml) |
| An idea for the web UI | [Web UI Feature Request / WebUI 機能追加の提案](../../issues/new?template=feature_request.yml) |
| You ran it on your PC (whether it worked or not) | [Compatibility Report / 動作報告](../../issues/new?template=compatibility_report.yml) |
| A fix or improvement you already made | Pull request (see below) |

Before opening an issue, please search the existing issues to avoid duplicates.

### What is in scope

- Setup and launch scripts, the model conversion and export tools (`tools/`), the server (`server/`) and the web UI
  (`webui/`).
- Translation quality **is** in scope when the converted model translates noticeably worse than the original
  PLaMo 3 Translate model on the same input (for example after INT4 quantization). If the original model makes the same
  mistake, it is a property of the model itself and cannot be fixed here.
- Support for other models, other hardware vendors or cloud services is out of scope.

## Collecting environment information

Most reports need the following. The **Statistics** panel in the web UI shows the device name and the NPU driver
version.

```powershell
# Windows version
[System.Environment]::OSVersion.VersionString
# CPU
(Get-CimInstance Win32_Processor).Name
# NPU driver version
Get-CimInstance Win32_PnPSignedDriver | Where-Object DeviceName -like "*AI Boost*" | Select-Object DeviceName, DriverVersion
# Installed OpenVINO packages
.\venv\Scripts\python.exe -m pip list | Select-String openvino
# Commit you are running
git rev-parse --short HEAD
```

For bugs, also attach the console output of `start-plamo-npu.bat` and, for web UI problems, any errors in the browser's
developer console (F12).

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Keep each pull request focused on one change. For larger changes, please open an issue first to discuss the idea.
3. Describe what you changed and how you tested it.

### Development setup

```bat
setup.bat              :: venv + packages + model build
setup.bat -SkipModel   :: packages only, if you already have the models
start-plamo-npu.bat    :: http://127.0.0.1:8100/
```

The web UI has no build step: edit the files in `webui/` and reload the browser.

### Guidelines

**General**

- Never commit model weights, converted models, the `venv/` or `.cache/` folders, or other large generated files.
  The model is distributed by Preferred Networks under the PLaMo Community License, and users download and convert it
  themselves.
- Keep user-facing messages in the launcher, setup scripts and API errors in English.

**Web UI (`webui/`)**

- **No external requests.** Do not add CDNs, web fonts, analytics or any other network access. Everything must work
  offline. Fonts come from the user's PC (Noto Sans per language, then the system sans-serif).
- Plain HTML, CSS and JavaScript ES modules, no frameworks or bundlers. Follow the existing Material Design 2 look.
- Every UI string goes into `webui/js/i18n.js` with a translation for **all seven UI languages** (ja, en, zh, ko, fr,
  de, es). If you cannot translate a language, use the English text and mention it in the pull request.
- Check light and dark themes, a narrow (phone-width) window, and at least one non-Latin UI language.

**Scripts**

- `.bat` files must be ASCII only.
- `.ps1` files must be saved as UTF-8 **with BOM** if they contain non-ASCII characters (Windows PowerShell 5.1).
- Line endings are handled by `.gitattributes` (CRLF for `.bat` / `.ps1`).

**Python (`server/`, `tools/`)**

- Python 3.10. Keep dependencies pinned in `requirements.txt` and explain any version change.

### Testing

With the server running:

```bat
venv\Scripts\python.exe -I tools\api_test.py
```

If you changed the conversion or export tools, also run `tools\verify_conversion.py` and `tools\npu_test.py`, and
include the translation output and speed in the pull request.

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE), the same
license as this project. The PLaMo model itself is not part of this repository and is covered by the
[PLaMo Community License](https://plamo.preferredai.jp/info/plamo-community-license-en).

---

## 日本語

バグ報告、動作報告、機能の提案、プルリクエストを歓迎します。Issue やプルリクエストは日本語で書いてかまいません。

本プロジェクトは非公式のコミュニティプロジェクトで、Preferred Networks や Intel とは関係ありません。
このツールに関する問題を両社に問い合わせないでください。

### Issue の種類

| 内容 | テンプレート |
| --- | --- |
| 期待どおりに動かない | [Bug Report / バグ報告](../../issues/new?template=bug_report.yml) |
| Web UI へのアイデア | [Web UI Feature Request / WebUI 機能追加の提案](../../issues/new?template=feature_request.yml) |
| 自分の PC で動かしてみた（動いた・動かなかったどちらでも） | [Compatibility Report / 動作報告](../../issues/new?template=compatibility_report.yml) |

Issue を作る前に、同じ内容の Issue がないか検索してください。

### 対象範囲

- セットアップ・起動スクリプト、モデルの変換ツール（`tools/`）、サーバー（`server/`）、Web UI（`webui/`）が対象です。
- 翻訳品質は、同じ入力で元の PLaMo 3 Translate より明らかに悪い場合（INT4 量子化の影響など）に限り対象です。
  元のモデルでも同じ誤りが出る場合はモデル自体の性質のため、ここでは直せません。
- 他のモデル、他社のハードウェア、クラウドサービスへの対応は対象外です。

### 環境情報の集め方

上の英語版にある PowerShell コマンドで、Windows のバージョン、CPU、NPU ドライバーのバージョン、OpenVINO のバージョン、
実行中のコミットを確認できます。デバイス名と NPU ドライバーのバージョンは Web UI の「統計」パネルにも表示されます。
バグ報告には `start-plamo-npu.bat` のコンソール出力も添えてください。Web UI の問題なら、ブラウザーの開発者ツール（F12）の
コンソールに出たエラーもお願いします。

### プルリクエスト

`main` から作ったブランチで、1 つのプルリクエストには 1 つの変更だけを入れてください。大きな変更は、先に Issue で相談してください。
変更内容と確認方法を説明に書いてください。

主な決まりごと（詳しくは英語版の Guidelines を参照）:

- モデルの重み、変換済みモデル、`venv/`、`.cache/` などの大きな生成物はコミットしない。
- Web UI は外部と通信しない（CDN・Web フォント・解析ツールなどを追加しない）。フレームワークやビルド手順も使わない。
- UI の文字列は `webui/js/i18n.js` に追加し、7 つの表示言語（ja, en, zh, ko, fr, de, es）すべての訳を入れる。
- `.bat` は ASCII のみ。非 ASCII を含む `.ps1` は BOM 付き UTF-8 で保存する。
- 起動・セットアップスクリプトと API のエラーメッセージは英語にする。
- サーバーを起動した状態で `tools\api_test.py` が通ることを確認する。

### ライセンス

コントリビューションは、本プロジェクトと同じ [Apache License 2.0](LICENSE) で提供されるものとします。
PLaMo のモデル自体は本リポジトリに含まれず、[PLaMo Community License](https://plamo.preferredai.jp/info/plamo-community-license-ja) が適用されます。
