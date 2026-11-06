// 接続先の設定。この UI は npu_server.py が API と一緒に配信するので、API は同じオリジン。
// llama.cpp の llama-server（OpenAI 互換 API）と組み合わせる場合は BACKEND = "gpu"、
// API_BASE = "http://127.0.0.1:8000" のように書き換える（統計は /api/stats を返すサーバーが必要）。
export const BACKEND = "npu";            // "npu" | "gpu"
export const API_BASE = "";              // 空文字 = このページと同じサーバー
export const STATS_URL = "/api/stats";
export const START_CMD = "start-plamo-npu.bat";

export const DEVICE_LABEL = BACKEND === "npu" ? "NPU" : "GPU";
