"""PLaMo 3 → Gemma 3 変換モデルを transformers で読み込むための互換パッチ。

Gemma3TextConfig は「hidden_size が num_attention_heads で割り切れること」を検証するが、
実際の計算は head_dim（明示指定）を使うため、この検証は不要。
PLaMo 3 2B は hidden_size=2560, heads=24, head_dim=128 なので検証だけを無効化する。
（site-packages は書き換えず、このプロセス内だけで差し替える）

@strict デコレーターはクラス作成時に検証関数を __class_validators__ に保持するため、
そのリストから validate_architecture を取り除く。
"""

from transformers.models.gemma3 import configuration_gemma3 as _cfg


def _validate_yarn_nested(self, rope_parameters: dict, ignore_keys: set | None = None) -> None:
    # transformers 5.x の YaRN 検証は、層タイプ別にネストした rope_parameters でも
    # self.rope_parameters["original_max_position_embeddings"] を直接読もうとして KeyError になる
    # （PLaMo 3 公式コードも同じ不具合を回避している）。必須キーの確認だけ行う。
    required = {"rope_type", "factor", "original_max_position_embeddings"}
    missing = required - set(rope_parameters)
    if missing:
        raise ValueError(f"yarn rope_parameters に必須キーがありません: {sorted(missing)}")
    if not rope_parameters["factor"] >= 1:
        raise ValueError(f"yarn factor must be >= 1, got {rope_parameters['factor']}")


def apply() -> None:
    cls = _cfg.Gemma3TextConfig
    validators = getattr(cls, "__class_validators__", None)
    if validators is not None:
        cls.__class_validators__ = [v for v in validators if v.__name__ != "validate_architecture"]
    cls.validate_architecture = lambda self: None
    cls._validate_yarn_rope_parameters = _validate_yarn_nested


apply()
