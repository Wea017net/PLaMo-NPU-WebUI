"""OpenVINO IR の入出力・重みの精度・利用可能デバイスを表示する。  python -I inspect_ir.py <xml>"""
import collections
import sys

import openvino as ov

core = ov.Core()
m = core.read_model(sys.argv[1])
print("inputs :", [(i.get_any_name(), str(i.get_partial_shape()), str(i.get_element_type())) for i in m.inputs])
print("outputs:", [(o.get_any_name(), str(o.get_partial_shape())) for o in m.outputs])
c = collections.Counter()
for op in m.get_ops():
    if op.get_type_name() == "Constant":
        s = list(op.get_output_shape(0))
        if len(s) >= 2 and s[0] * s[1] > 1_000_000:
            c[str(op.get_output_element_type(0))] += 1
print("large constants by dtype:", dict(c))
print("stateful sinks:", len(m.get_sinks()))
print("devices:", core.available_devices)
for d in core.available_devices:
    print(f"  {d}: {core.get_property(d, 'FULL_DEVICE_NAME')}")
