# PLaMo NPU WebUI

[English](README.md) | **日本語**

Preferred Networks の翻訳モデル [PLaMo 3 Translate 2B](https://huggingface.co/pfnet/plamo-3-translate-2b) を、
Intel Core Ultra 搭載 PC の **NPU（Intel® AI Boost）** で動かすためのツールです。完全にオフラインで動作し、
ブラウザから使える翻訳 UI が付属します。

> [!IMPORTANT]
> これは**非公式のサードパーティ製**プロジェクトです。Preferred Networks, Inc. および Intel Corporation とは関係がなく、
> 両社の支援・承認を受けたものではありません。**Built with PLaMo.**
> モデル本体はこのリポジトリに**含まれていません**。モデルには別途
> [PLaMo Community License](https://plamo.preferredai.jp/info/plamo-community-license-ja) が適用されます。

## 特長

- **NPU で動作**: [OpenVINO GenAI](https://github.com/openvinotoolkit/openvino.genai) で推論します。GPU や CPU の大部分は空いたままです。
- **オフライン**: セットアップ後はインターネットとの通信を一切行いません（Web フォントや CDN も使いません）。
- **翻訳 UI**（Material Design 2）: 左右の入力・訳文欄、7 言語、即時翻訳のオン / オフ、言語の入れ替え、ダーク / ライトテーマ、
  ストリーミング表示、統計（NPU のメモリと使用率、速度、トークン数）。
- **UI は 7 言語に対応**: 日本語、English、简体中文、한국어、Français、Deutsch、Español。
  文字はその言語の Noto Sans（`Noto Sans JP` / `SC` / `KR` / `Noto Sans`）がインストールされていればそれを使い、
  無ければシステムの sans-serif フォントで表示します。
- **OpenAI 互換 API**（`/v1/chat/completions`、ストリーミング対応）。リクエスト形式は llama.cpp の `llama-server` と同じです。

## 仕組み

OpenVINO は PLaMo 3 のアーキテクチャに直接対応していません。ただし PLaMo 3 は **Gemma 3** とほぼ同じ構造
（サンドイッチ正規化・QK 正規化・スライディング窓注意と全体注意の交互配置・層ごとの RoPE）なので、
残りの違いは重みの書き換えで吸収できます。

| PLaMo 3 | Gemma 3 | 変換方法 |
|---|---|---|
| RMSNorm が `(offset + w)`（offset は 1.0 / 0.2 / 5^-1.5） | `(1 + w)` | `w' = w + offset - 1` |
| 埋め込みの倍率なし | 埋め込み × √hidden_size | `E' = E / √hidden_size` |
| SwiGLU（SiLU） | GeGLU | `hidden_activation = "silu"` |
| 融合された `qkv_proj` / `gate_up_proj` | 個別の射影 | 行列を分割 |

`tools/convert_plamo3_to_gemma3.py` で重みを書き換え、`tools/verify_conversion.py` で元のモデルと変換後のモデルの
logits と貪欲生成の結果が一致することを確認しています（CPU・FP32）。それを OpenVINO の stateful IR に書き出し、
NNCF で INT4 に圧縮します。サーバー（`server/npu_server.py`）は NPU 上の `LLMPipeline` で推論し、
トークナイザーは PLaMo 独自のものを Python で使います。

## 動作環境

- Windows 11
- NPU を搭載した Intel Core Ultra プロセッサーと Intel NPU ドライバー
  （確認済み: Core Ultra 7 258V / Lunar Lake、NPU ドライバー 32.0.100.5540、メモリ 32 GB）
- Python 3.10（3.10.6 で確認）
- ディスクの空き: セットアップ中は約 25 GB（完了後は約 4 GB）
- インターネット接続はセットアップ時のみ必要（Python パッケージと Hugging Face からのモデル取得）

## セットアップ

```bat
git clone https://github.com/Wea017net/PLaMo-NPU-WebUI.git
cd PLaMo-NPU-WebUI
setup.bat
```

`setup.bat` は `venv\` を作って [requirements.txt](requirements.txt) をインストールし、`tools\build_model.py` を実行します。

1. `pfnet/plamo-3-translate-2b` を `hf\` にダウンロード — **これにより PLaMo Community License に同意したことになります**
2. Gemma 3 形式に変換
3. BF16 の OpenVINO IR に書き出し
4. `models\` に INT4 モデルを作成（`plamo3-2b-ov-int4-cw` と `plamo3-2b-ov-int4-g128`）
5. 中間ファイルを削除（残す場合は `--keep-intermediate`）

オプション: `setup.bat -Variants cw`（片方のモデルだけ作る）、`setup.bat -SkipModel`（パッケージのみ）。

## 使い方

```bat
start-plamo-npu.bat
```

ブラウザで <http://127.0.0.1:8100/> が開きます。初回起動時はモデルを NPU 向けにコンパイルするため 1 分ほどかかります。
2 回目以降は `.cache\ov` のキャッシュを使うので数秒で起動します。停止するには <kbd>Ctrl</kbd>+<kbd>C</kbd> を押すか、
ウィンドウを閉じてください。

| オプション | 説明 |
|---|---|
| `-Model cw`（既定） | INT4・チャンネル単位。NPU で最も速い |
| `-Model g128` | INT4・グループサイズ 128。元の BF16 モデルに最も近い訳 |
| `-Port 8100` | UI と API のポート |
| `-NoBrowser` | ブラウザを開かない |

### 実測値（Core Ultra 7 258V）

| モデル | 生成速度 | 最初のトークンまで | 備考 |
|---|---|---|---|
| `int4-cw` | 約 20〜24 tok/s | 約 0.5〜0.6 秒 | BF16 と言い回しが少し変わることがある |
| `int4-g128` | 約 16〜18 tok/s | 約 0.95 秒 | 試した範囲では BF16 と同じ訳 |

### API

```bash
curl http://127.0.0.1:8100/v1/chat/completions -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Hello, world!\"}],\"chat_template_kwargs\":{\"target_lang\":\"ja\"}}"
```

`chat_template_kwargs` には、モデルのチャットテンプレートと同じく `target_lang`（必須）、`source_lang`、
`form`（`polite` / `plain`、日本語のみ）、`context`、`glossary`（`[{"source": "...", "target": "..."}]`）を指定できます。
`"stream": true` で Server-Sent Events になり、最後のチャンクに llama.cpp と同じ形の `timings` が付きます。
ほかのエンドポイント: `GET /health`、`/props`、`/v1/models`、`/api/stats`。

## 制限事項

- NPU では入出力の長さを固定する必要があり、既定では入力 **1,024 トークン**、出力 **1,024 トークン**までです
  （`server/npu_server.py` の `--max-prompt` / `--max-response`。変えると再コンパイルされます）。長い文章は分けて翻訳してください。
- 同時に処理するのは 1 リクエストだけです。新しいリクエストが来ると実行中のものを打ち切ります（UI で入力し続けたときの動作）。
- 動作確認は上記のハードウェアでのみ行っています。

## ファイル構成

```
server/   npu_server.py（API + UI サーバー）、pfml.py（プロンプト形式）、gemma3_compat.py
tools/    build_model.py、変換・書き出し・量子化のスクリプト、検証・速度測定のスクリプト
webui/    index.html、css/、js/（ES モジュール）、assets/（アイコンフォント、favicon）
```

`models/`、`hf/`、`venv/`、`.cache/` は手元で作られるもので、git の管理対象外です。

## ライセンス

- **このリポジトリのコード**: [Apache License 2.0](LICENSE)。Copyright 2026 Wea017net.
- **PLaMo 3 Translate**（同梱なし）: Preferred Networks, Inc. の
  [PLaMo Community License](https://plamo.preferredai.jp/info/plamo-community-license-ja)。要点は次のとおりです
  （正式な条件はライセンス本文を確認してください）。
  - 個人・学術目的の利用は無料です。**商用利用には PFN への事前登録が必要**で、年間売上 10 億円以下の組織に限られます
    （それを超える場合は別途契約が必要です）。
  - モデルや派生モデルを第三者に提供するときは、ライセンスの写しを添え、**「Built with PLaMo」** と表示し、
    モデル名に「PLaMo」を含めてください。
  - 訳文を公開するときは、モデルによる出力であることを明記してください。
  - 法律・医療・金融などの重要な判断の唯一の根拠として出力を使わないでください。
- **サードパーティ製のもの**: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) と [NOTICE](NOTICE) を参照してください。

## 免責事項

訳文は AI モデルが生成したもので、正確とは限りません。本ソフトウェアは「現状のまま」提供され、いかなる保証もありません。
ご自身の責任でお使いください。

## 謝辞

- PLaMo 3 Translate を公開している [Preferred Networks](https://www.preferred.jp/)
- [OpenVINO](https://github.com/openvinotoolkit/openvino) と [Optimum Intel](https://github.com/huggingface/optimum-intel)
- Google の [Material Symbols](https://fonts.google.com/icons)
