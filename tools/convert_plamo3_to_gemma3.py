"""PLaMo 3 (Plamo3ForCausalLM) の重みを Gemma 3 テキストモデル (Gemma3ForCausalLM) 形式に変換する。

PLaMo 3 と Gemma 3 は構造がほぼ同じ（サンドイッチ正規化・QK 正規化・スライディング窓と
全体注意の交互配置・層別 RoPE）。違いは次の 4 点で、すべて重みの書き換えで吸収できる。

  1. RMSNorm のオフセット … PLaMo は (offset + w)、Gemma 3 は (1 + w)
       → w' = w + offset - 1   （offset: pre=1.0, post_mixer=0.2, post_mlp=5^-1.5）
  2. 埋め込みの倍率      … PLaMo は等倍、Gemma 3 は sqrt(hidden_size) 倍
       → E' = E / sqrt(hidden_size)
  3. 活性化関数          … PLaMo は SwiGLU (SiLU) → config の hidden_activation="silu"
  4. 融合された線形層    … qkv_proj / gate_up_proj を q/k/v・gate/up に分割

使い方:
  python -I convert_plamo3_to_gemma3.py <PLaMo の HF フォルダ> <出力フォルダ>
"""

import json
import math
import sys
from pathlib import Path

import torch
from safetensors import safe_open
from safetensors.torch import save_file

POST_MIXER_OFFSET = 1.0 / 5
POST_MLP_OFFSET = 1.0 / (5 ** 1.5)


def load_all(src: Path) -> dict[str, torch.Tensor]:
    index = json.loads((src / "model.safetensors.index.json").read_text(encoding="utf-8"))
    tensors = {}
    for shard in sorted(set(index["weight_map"].values())):
        with safe_open(str(src / shard), framework="pt") as f:
            for k in f.keys():
                tensors[k] = f.get_tensor(k)
    return tensors


def main(src: Path, dst: Path) -> None:
    cfg = json.loads((src / "config.json").read_text(encoding="utf-8"))
    assert cfg["model_type"] == "plamo3"
    assert cfg.get("linear_type", "normal") == "normal"
    assert not cfg.get("scale_embedding", False)
    assert cfg.get("image_feature_size") is None

    H = cfg["hidden_size"]
    n_layers = cfg["num_hidden_layers"]
    n_q, n_kv, d = cfg["num_attention_heads"], cfg["num_key_value_heads"], cfg["head_dim"]
    inter = cfg["intermediate_size"]
    pattern = cfg["sliding_window_pattern"]
    q_dim, kv_dim = n_q * d, n_kv * d

    print(f"loading {src} ...", flush=True)
    w = load_all(src)
    out: dict[str, torch.Tensor] = {}

    def f32(t):
        return t.to(torch.float32)

    # 埋め込み（Gemma 3 は sqrt(H) 倍するので割っておく）。精度のため fp32 で保存
    out["model.embed_tokens.weight"] = f32(w.pop("model.embed_tokens.weight")) / math.sqrt(H)
    out["model.norm.weight"] = f32(w.pop("model.norm.weight"))  # offset 1.0 → そのまま
    lm_head = w.pop("lm_head.weight")
    assert lm_head.shape[0] == cfg["vocab_size"], "lm_head のパディングは未対応"
    out["lm_head.weight"] = lm_head

    for i in range(n_layers):
        p = f"model.layers.layers.{i}."
        o = f"model.layers.{i}."
        qkv = w.pop(p + "mixer.qkv_proj.weight")
        assert qkv.shape[0] == q_dim + 2 * kv_dim
        q, k, v = torch.split(qkv, [q_dim, kv_dim, kv_dim], dim=0)
        out[o + "self_attn.q_proj.weight"] = q.contiguous()
        out[o + "self_attn.k_proj.weight"] = k.contiguous()
        out[o + "self_attn.v_proj.weight"] = v.contiguous()
        out[o + "self_attn.o_proj.weight"] = w.pop(p + "mixer.o_proj.weight")
        out[o + "self_attn.q_norm.weight"] = f32(w.pop(p + "mixer.q_norm.weight"))
        out[o + "self_attn.k_norm.weight"] = f32(w.pop(p + "mixer.k_norm.weight"))

        gate_up = w.pop(p + "mlp.gate_up_proj.weight")
        assert gate_up.shape[0] == 2 * inter
        gate, up = gate_up.chunk(2, dim=0)  # _swiglu: silu(前半) * 後半
        out[o + "mlp.gate_proj.weight"] = gate.contiguous()
        out[o + "mlp.up_proj.weight"] = up.contiguous()
        out[o + "mlp.down_proj.weight"] = w.pop(p + "mlp.down_proj.weight")

        out[o + "input_layernorm.weight"] = f32(w.pop(p + "pre_mixer_norm.weight"))
        out[o + "post_attention_layernorm.weight"] = f32(w.pop(p + "post_mixer_norm.weight")) + (POST_MIXER_OFFSET - 1.0)
        out[o + "pre_feedforward_layernorm.weight"] = f32(w.pop(p + "pre_mlp_norm.weight"))
        out[o + "post_feedforward_layernorm.weight"] = f32(w.pop(p + "post_mlp_norm.weight")) + (POST_MLP_OFFSET - 1.0)

    assert not w, f"未変換の重みがあります: {list(w)[:5]}"

    layer_types = [
        "full_attention" if (i + 1) % pattern == 0 else "sliding_attention" for i in range(n_layers)
    ]
    rope = cfg["rope_parameters"]
    gemma_cfg = {
        "architectures": ["Gemma3ForCausalLM"],
        "model_type": "gemma3_text",
        "vocab_size": cfg["vocab_size"],
        "hidden_size": H,
        "intermediate_size": inter,
        "num_hidden_layers": n_layers,
        "num_attention_heads": n_q,
        "num_key_value_heads": n_kv,
        "head_dim": d,
        "hidden_activation": "silu",
        "max_position_embeddings": 32768,  # 学習時の最大長（入出力合計）
        "rms_norm_eps": cfg["rms_norm_eps"],
        "query_pre_attn_scalar": d,         # SDPA 既定の 1/sqrt(head_dim) と同じにする
        "sliding_window": cfg["window_size"],
        "layer_types": layer_types,
        "rope_parameters": {
            "full_attention": dict(rope["full_attention"]),
            "sliding_attention": dict(rope["sliding_attention"]),
        },
        "attn_logit_softcapping": None,
        "final_logit_softcapping": None,
        "attention_bias": False,
        "attention_dropout": 0.0,
        "tie_word_embeddings": False,
        "use_bidirectional_attention": False,
        "bos_token_id": 1,
        "eos_token_id": [1, 16],
        "pad_token_id": cfg.get("pad_token_id", 3),
        "use_cache": True,
        "dtype": "float32",
        "plamo3_conversion": {
            "source": "pfnet/plamo-3-translate-2b",
            "note": "Converted from Plamo3ForCausalLM: norm offsets folded, embeddings divided by sqrt(hidden_size).",
        },
    }

    dst.mkdir(parents=True, exist_ok=True)
    print(f"saving {len(out)} tensors to {dst} ...", flush=True)
    save_file(out, str(dst / "model.safetensors"), metadata={"format": "pt"})
    (dst / "config.json").write_text(json.dumps(gemma_cfg, indent=2, ensure_ascii=False), encoding="utf-8")
    (dst / "generation_config.json").write_text(
        json.dumps({"bos_token_id": 1, "eos_token_id": [1, 16], "pad_token_id": 3, "do_sample": False}, indent=2),
        encoding="utf-8",
    )
    print("done", flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
