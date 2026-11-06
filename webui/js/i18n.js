// UI の多言語対応
// 各キーの訳は [ja, en, zh, ko, fr, de, es] の順。{x} は t() の引数で差し込む。

import { store } from "./util.js";

export const UI_LANGS = [
  // [コード, 自言語での名前, Intl 用ロケール]
  ["ja", "日本語", "ja-JP"], ["en", "English", "en-US"], ["zh", "简体中文", "zh-CN"], ["ko", "한국어", "ko-KR"],
  ["fr", "Français", "fr-FR"], ["de", "Deutsch", "de-DE"], ["es", "Español", "es-ES"],
];

const I18N = {
  app:        ["PLaMo 翻訳", "PLaMo Translate", "PLaMo 翻译", "PLaMo 번역", "PLaMo Traduction", "PLaMo Übersetzer", "PLaMo Traductor"],
  ui_lang:    ["表示言語", "Display language", "界面语言", "표시 언어", "Langue de l'interface", "Anzeigesprache", "Idioma de la interfaz"],
  to_light:   ["ライトモードに切り替え", "Switch to light mode", "切换到浅色模式", "라이트 모드로 전환", "Passer en mode clair", "Zum hellen Modus wechseln", "Cambiar al modo claro"],
  to_dark:    ["ダークモードに切り替え", "Switch to dark mode", "切换到深色模式", "다크 모드로 전환", "Passer en mode sombre", "Zum dunklen Modus wechseln", "Cambiar al modo oscuro"],
  st_checking:["接続確認中…", "Connecting…", "正在连接…", "연결 확인 중…", "Connexion…", "Verbindung wird geprüft…", "Conectando…"],
  st_loading: ["モデル読み込み中…", "Loading model…", "正在加载模型…", "모델 로드 중…", "Chargement du modèle…", "Modell wird geladen…", "Cargando modelo…"],
  st_failed:  ["読み込み失敗", "Load failed", "加载失败", "로드 실패", "Échec du chargement", "Laden fehlgeschlagen", "Error de carga"],
  st_offline: ["オフライン", "Offline", "离线", "오프라인", "Hors ligne", "Offline", "Sin conexión"],
  st_busy:    ["翻訳中", "Translating", "翻译中", "번역 중", "Traduction…", "Übersetzung…", "Traduciendo"],
  st_online:  ["待機中", "Ready", "就绪", "대기 중", "Prêt", "Bereit", "Listo"],
  st_nostats: ["統計サーバー未接続", "Stats server unavailable", "统计服务器未连接", "통계 서버 연결 안 됨", "Serveur de statistiques indisponible", "Statistikserver nicht erreichbar", "Servidor de estadísticas no disponible"],
  banner_gpu: ["llama-server に接続できません。{cmd} で起動してください。", "Cannot connect to llama-server. Start it with {cmd}.", "无法连接到 llama-server。请使用 {cmd} 启动。", "llama-server에 연결할 수 없습니다. {cmd}(으)로 시작하세요.", "Impossible de se connecter à llama-server. Lancez-le avec {cmd}.", "Keine Verbindung zu llama-server. Starten Sie ihn mit {cmd}.", "No se puede conectar con llama-server. Inícielo con {cmd}."],
  banner_npu: ["NPU 翻訳サーバーに接続できません。{cmd} で起動してください。", "Cannot connect to the NPU translation server. Start it with {cmd}.", "无法连接到 NPU 翻译服务器。请使用 {cmd} 启动。", "NPU 번역 서버에 연결할 수 없습니다. {cmd}(으)로 시작하세요.", "Impossible de se connecter au serveur de traduction NPU. Lancez-le avec {cmd}.", "Keine Verbindung zum NPU-Übersetzungsserver. Starten Sie ihn mit {cmd}.", "No se puede conectar con el servidor de traducción NPU. Inícielo con {cmd}."],
  err_gpu:    ["llama-server が起動しているか確認してください。", "Check that llama-server is running.", "请确认 llama-server 是否正在运行。", "llama-server가 실행 중인지 확인하세요.", "Vérifiez que llama-server est en cours d'exécution.", "Prüfen Sie, ob llama-server läuft.", "Compruebe que llama-server se está ejecutando."],
  err_npu:    ["NPU 翻訳サーバーの状態を確認してください。", "Check the status of the NPU translation server.", "请检查 NPU 翻译服务器的状态。", "NPU 번역 서버의 상태를 확인하세요.", "Vérifiez l'état du serveur de traduction NPU.", "Prüfen Sie den Status des NPU-Übersetzungsservers.", "Compruebe el estado del servidor de traducción NPU."],
  error:      ["エラー: ", "Error: ", "错误：", "오류: ", "Erreur : ", "Fehler: ", "Error: "],
  src_langs:  ["翻訳元の言語", "Source language", "源语言", "원본 언어", "Langue source", "Ausgangssprache", "Idioma de origen"],
  dst_langs:  ["翻訳先の言語", "Target language", "目标语言", "대상 언어", "Langue cible", "Zielsprache", "Idioma de destino"],
  swap:       ["言語を入れ替え", "Swap languages", "交换语言", "언어 바꾸기", "Inverser les langues", "Sprachen tauschen", "Intercambiar idiomas"],
  detect:     ["言語を検出", "Detect language", "检测语言", "언어 감지", "Détecter la langue", "Sprache erkennen", "Detectar idioma"],
  all_langs:  ["すべての言語", "All languages", "所有语言", "모든 언어", "Toutes les langues", "Alle Sprachen", "Todos los idiomas"],
  input_ph:   ["テキストを入力", "Enter text", "输入文本", "텍스트 입력", "Saisissez du texte", "Text eingeben", "Introduzca texto"],
  src_text:   ["翻訳元のテキスト", "Source text", "源文本", "원본 텍스트", "Texte source", "Ausgangstext", "Texto de origen"],
  clear:      ["テキストを消去", "Clear text", "清除文本", "텍스트 지우기", "Effacer le texte", "Text löschen", "Borrar texto"],
  chars:      ["{n} 文字", "{n} characters", "{n} 个字符", "{n}자", "{n} caractères", "{n} Zeichen", "{n} caracteres"],
  translate:  ["翻訳", "Translate", "翻译", "번역", "Traduire", "Übersetzen", "Traducir"],
  instant:    ["即時翻訳", "Instant translation", "即时翻译", "즉시 번역", "Traduction instantanée", "Sofortübersetzung", "Traducción instantánea"],
  instant_title: ["入力と同時に翻訳する", "Translate as you type", "输入时自动翻译", "입력과 동시에 번역", "Traduire pendant la saisie", "Beim Tippen übersetzen", "Traducir mientras escribe"],
  form_title: ["日本語訳の文体", "Style of the Japanese translation", "日语译文的文体", "일본어 번역문의 문체", "Style de la traduction japonaise", "Stil der japanischen Übersetzung", "Estilo de la traducción al japonés"],
  form_btn:   ["文体: {v}", "Style: {v}", "文体：{v}", "문체: {v}", "Style : {v}", "Stil: {v}", "Estilo: {v}"],
  form_auto:  ["自動", "Auto", "自动", "자동", "Auto", "Automatisch", "Automático"],
  form_polite:["敬体", "Polite", "敬体", "경어체", "Poli", "Höflich", "Cortés"],
  form_plain: ["常体", "Plain", "常体", "평어체", "Neutre", "Neutral", "Neutro"],
  form_auto_full:   ["自動（指定しない）", "Auto (not specified)", "自动（不指定）", "자동 (지정 안 함)", "Auto (non précisé)", "Automatisch (nicht festgelegt)", "Automático (sin especificar)"],
  form_polite_full: ["敬体（です・ます調）", "Polite (です・ます)", "敬体（です・ます体）", "경어체 (です・ます체)", "Poli (です・ます)", "Höflich (です・ます)", "Cortés (です・ます)"],
  form_plain_full:  ["常体（だ・である調）", "Plain (だ・である)", "常体（だ・である体）", "평어체 (だ・である체)", "Neutre (だ・である)", "Neutral (だ・である)", "Neutro (だ・である)"],
  out_ph:     ["翻訳", "Translation", "译文", "번역", "Traduction", "Übersetzung", "Traducción"],
  copy:       ["訳文をコピー", "Copy translation", "复制译文", "번역문 복사", "Copier la traduction", "Übersetzung kopieren", "Copiar traducción"],
  copied:     ["訳文をコピーしました", "Translation copied", "已复制译文", "번역문을 복사했습니다", "Traduction copiée", "Übersetzung kopiert", "Traducción copiada"],
  copy_failed:["コピーできませんでした", "Couldn't copy", "无法复制", "복사하지 못했습니다", "Copie impossible", "Kopieren fehlgeschlagen", "No se pudo copiar"],
  hint_on:    ["入力すると自動で翻訳します · {k} ですぐに翻訳", "Translates automatically as you type · {k} to translate now", "输入后自动翻译 · 按 {k} 立即翻译", "입력하면 자동으로 번역합니다 · {k}로 바로 번역", "Traduction automatique pendant la saisie · {k} pour traduire immédiatement", "Übersetzt automatisch beim Tippen · {k} übersetzt sofort", "Traduce automáticamente al escribir · {k} para traducir ahora"],
  hint_off:   ["「翻訳」ボタンか {k} で翻訳します", "Press Translate or {k} to translate", "点击“翻译”按钮或按 {k} 进行翻译", "[번역] 버튼이나 {k}로 번역합니다", "Cliquez sur Traduire ou appuyez sur {k} pour traduire", "Klicken Sie auf „Übersetzen“ oder drücken Sie {k}", "Pulse Traducir o {k} para traducir"],
  sec:        ["{n} 秒", "{n} s", "{n} 秒", "{n}초", "{n} s", "{n} s", "{n} s"],
  stats:      ["統計", "Statistics", "统计", "통계", "Statistiques", "Statistiken", "Estadísticas"],
  stats_hide: ["統計を折りたたむ", "Collapse statistics", "收起统计", "통계 접기", "Masquer les statistiques", "Statistiken einklappen", "Contraer estadísticas"],
  stats_show: ["統計を展開", "Expand statistics", "展开统计", "통계 펼치기", "Afficher les statistiques", "Statistiken ausklappen", "Expandir estadísticas"],
  updated:    ["更新 {t}", "Updated {t}", "更新于 {t}", "업데이트 {t}", "Mis à jour {t}", "Aktualisiert {t}", "Actualizado {t}"],
  detecting:  ["検出中…", "Detecting…", "检测中…", "감지 중…", "Détection…", "Wird erkannt…", "Detectando…"],
  dev_mem:    ["{dev} メモリ（{proc}）", "{dev} memory ({proc})", "{dev} 内存（{proc}）", "{dev} 메모리 ({proc})", "Mémoire {dev} ({proc})", "{dev}-Speicher ({proc})", "Memoria de {dev} ({proc})"],
  dev_util:   ["{dev} 使用率", "{dev} utilization", "{dev} 使用率", "{dev} 사용률", "Utilisation {dev}", "{dev}-Auslastung", "Uso de {dev}"],
  memory:     ["メモリ", "Memory", "内存", "메모리", "Mémoire", "Arbeitsspeicher", "Memoria"],
  tr_server:  ["翻訳サーバー", "Translation server", "翻译服务器", "번역 서버", "Serveur de traduction", "Übersetzungsserver", "Servidor de traducción"],
  system:     ["システム全体", "System total", "系统总计", "시스템 전체", "Système", "Gesamtsystem", "Sistema"],
  speed:      ["速度（直近の翻訳）", "Speed (last translation)", "速度（最近一次翻译）", "속도 (최근 번역)", "Vitesse (dernière traduction)", "Geschwindigkeit (letzte Übersetzung)", "Velocidad (última traducción)"],
  gen_tps:    ["生成 tok/s", "Generation tok/s", "生成 tok/s", "생성 tok/s", "Génération tok/s", "Generierung tok/s", "Generación tok/s"],
  prompt_tps: ["入力処理 tok/s", "Prompt tok/s", "输入处理 tok/s", "입력 처리 tok/s", "Entrée tok/s", "Eingabe tok/s", "Entrada tok/s"],
  totals:     ["累計（サーバー起動から）", "Totals (since server start)", "累计（自服务器启动）", "누계 (서버 시작 이후)", "Totaux (depuis le démarrage)", "Gesamt (seit Serverstart)", "Totales (desde el inicio)"],
  in_tok:     ["入力トークン", "Input tokens", "输入 token", "입력 토큰", "Jetons d'entrée", "Eingabe-Tokens", "Tokens de entrada"],
  out_tok:    ["出力トークン", "Output tokens", "输出 token", "출력 토큰", "Jetons de sortie", "Ausgabe-Tokens", "Tokens de salida"],
  req_proc:   ["処理中のリクエスト", "Requests in progress", "处理中的请求", "처리 중인 요청", "Requêtes en cours", "Laufende Anfragen", "Solicitudes en curso"],
  model:      ["モデル", "Model", "模型", "모델", "Modèle", "Modell", "Modelo"],
  file:       ["ファイル", "File", "文件", "파일", "Fichier", "Datei", "Archivo"],
  quant:      ["量子化", "Quantization", "量化", "양자화", "Quantification", "Quantisierung", "Cuantización"],
  ctx:        ["コンテキスト長", "Context length", "上下文长度", "컨텍스트 길이", "Longueur de contexte", "Kontextlänge", "Longitud de contexto"],
  slots:      ["スロット数", "Slots", "槽位数", "슬롯 수", "Emplacements", "Slots", "Ranuras"],
  driver:     ["ドライバー {v}", "Driver {v}", "驱动 {v}", "드라이버 {v}", "Pilote {v}", "Treiber {v}", "Controlador {v}"],
  alloc:      ["割り当て上限 {v} GB", "Allocation limit {v} GB", "分配上限 {v} GB", "할당 한도 {v} GB", "Limite d'allocation {v} GB", "Zuweisungslimit {v} GB", "Límite de asignación {v} GB"],
  mem_sub:    ["共有 {s} GB · 専用 {d} GB · {c} GB 中 {p}%", "Shared {s} GB · Dedicated {d} GB · {p}% of {c} GB", "共享 {s} GB · 专用 {d} GB · 占 {c} GB 的 {p}%", "공유 {s} GB · 전용 {d} GB · {c} GB 중 {p}%", "Partagée {s} GB · Dédiée {d} GB · {p} % de {c} GB", "Geteilt {s} GB · Dediziert {d} GB · {p} % von {c} GB", "Compartida {s} GB · Dedicada {d} GB · {p} % de {c} GB"],
  fetching:   ["取得中…", "Fetching…", "获取中…", "가져오는 중…", "Récupération…", "Wird abgerufen…", "Obteniendo…"],

  // ---- フッター・ライセンスダイアログ
  unofficial: ["非公式のサードパーティ製ツールです。Preferred Networks および Intel とは関係ありません。", "Unofficial third-party tool. Not affiliated with or endorsed by Preferred Networks or Intel.", "非官方的第三方工具，与 Preferred Networks 及 Intel 无关。", "비공식 서드파티 도구입니다. Preferred Networks 및 Intel과 관련이 없습니다.", "Outil tiers non officiel, sans lien avec Preferred Networks ni Intel.", "Inoffizielles Drittanbieter-Tool, nicht mit Preferred Networks oder Intel verbunden.", "Herramienta de terceros no oficial, sin relación con Preferred Networks ni Intel."],
  mt_notice:  ["訳文は AI による機械翻訳で、誤りを含むことがあります。", "Translations are machine-generated by AI and may contain errors.", "译文由 AI 机器翻译生成，可能包含错误。", "번역문은 AI 기계 번역으로 오류가 있을 수 있습니다.", "Les traductions sont générées automatiquement par une IA et peuvent contenir des erreurs.", "Die Übersetzungen werden maschinell von einer KI erstellt und können Fehler enthalten.", "Las traducciones las genera una IA automáticamente y pueden contener errores."],
  about:      ["ライセンスと注意事項", "Licenses & notices", "许可证与注意事项", "라이선스 및 주의 사항", "Licences et avertissements", "Lizenzen und Hinweise", "Licencias y avisos"],
  close:      ["閉じる", "Close", "关闭", "닫기", "Fermer", "Schließen", "Cerrar"],
  notices:    ["注意事項", "Notices", "注意事项", "주의 사항", "Avertissements", "Hinweise", "Avisos"],
  notice_output: ["訳文を公開するときは、PLaMo 3 Translate による出力であることを明記してください（PLaMo Community License 第 5 条）。", "When you publish translations, state that they were generated by PLaMo 3 Translate (PLaMo Community License, Article 5).", "公开译文时，请注明其为 PLaMo 3 Translate 的输出（PLaMo Community License 第 5 条）。", "번역문을 공개할 때는 PLaMo 3 Translate의 출력임을 명시하세요 (PLaMo Community License 제5조).", "Si vous publiez des traductions, indiquez qu'elles ont été générées par PLaMo 3 Translate (PLaMo Community License, article 5).", "Wenn Sie Übersetzungen veröffentlichen, geben Sie an, dass sie von PLaMo 3 Translate erzeugt wurden (PLaMo Community License, Artikel 5).", "Si publica traducciones, indique que las generó PLaMo 3 Translate (PLaMo Community License, artículo 5)."],
  notice_decision: ["法律・医療・金融などの重要な判断の唯一の根拠として使わないでください（同第 7 条）。", "Do not use translations as the sole basis for legal, medical, financial or other important decisions (Article 7).", "请勿将译文作为法律、医疗、金融等重要判断的唯一依据（第 7 条）。", "법률·의료·금융 등 중요한 판단의 유일한 근거로 사용하지 마세요 (제7조).", "N'utilisez pas les traductions comme seule base pour des décisions juridiques, médicales, financières ou autres décisions importantes (article 7).", "Verwenden Sie Übersetzungen nicht als alleinige Grundlage für rechtliche, medizinische, finanzielle oder andere wichtige Entscheidungen (Artikel 7).", "No utilice las traducciones como única base para decisiones legales, médicas, financieras u otras decisiones importantes (artículo 7)."],
  notice_commercial: ["商用利用には PFN への事前登録が必要です（年間売上 10 億円以下の場合。超える場合は別途契約）。", "Commercial use requires prior registration with PFN (for annual revenue up to 1 billion yen; above that, a separate agreement is required).", "商业使用需事先向 PFN 登记（年收入不超过 10 亿日元；超过则需另行签约）。", "상업적 이용에는 PFN에 사전 등록이 필요합니다 (연 매출 10억 엔 이하. 초과 시 별도 계약).", "Toute utilisation commerciale nécessite un enregistrement préalable auprès de PFN (chiffre d'affaires annuel jusqu'à 1 milliard de yens ; au-delà, un contrat distinct est requis).", "Kommerzielle Nutzung erfordert eine vorherige Registrierung bei PFN (bei einem Jahresumsatz bis 1 Milliarde Yen; darüber ist ein gesonderter Vertrag nötig).", "El uso comercial requiere registro previo ante PFN (con ingresos anuales de hasta 1000 millones de yenes; por encima, se necesita un contrato aparte)."],
  components: ["使用しているソフトウェアとモデル", "Software and models used", "使用的软件和模型", "사용 중인 소프트웨어 및 모델", "Logiciels et modèles utilisés", "Verwendete Software und Modelle", "Software y modelos utilizados"],
  lic_app:    ["このアプリ", "This app", "本应用", "이 앱", "Cette application", "Diese App", "Esta aplicación"],
  lic_model:  ["モデルの重みは同梱していません。各自が Hugging Face から取得し、この PC 上で変換しています。", "Model weights are not bundled. Each user downloads them from Hugging Face and converts them on their own PC.", "未附带模型权重。用户需自行从 Hugging Face 下载并在本机上转换。", "모델 가중치는 포함되어 있지 않습니다. 각자 Hugging Face에서 받아 이 PC에서 변환합니다.", "Les poids du modèle ne sont pas inclus. Chaque utilisateur les télécharge depuis Hugging Face et les convertit sur son propre PC.", "Die Modellgewichte sind nicht enthalten. Jeder lädt sie selbst von Hugging Face herunter und konvertiert sie auf dem eigenen PC.", "Los pesos del modelo no se incluyen. Cada usuario los descarga de Hugging Face y los convierte en su propio PC."],
  lic_bundled:["同梱", "Bundled", "随附", "포함", "Inclus", "Enthalten", "Incluido"],
  lic_system: ["PC にインストール済みのものを使用（同梱なし）", "Uses the copy installed on your PC (not bundled)", "使用本机已安装的字体（未随附）", "PC에 설치된 글꼴 사용 (미포함)", "Utilise la copie installée sur votre PC (non incluse)", "Verwendet die auf dem PC installierte Schrift (nicht enthalten)", "Usa la copia instalada en su PC (no incluida)"],
  lic_runtime:["実行時に使用（pip でインストール、同梱なし）", "Used at runtime (installed with pip, not bundled)", "运行时使用（通过 pip 安装，未随附）", "실행 시 사용 (pip로 설치, 미포함)", "Utilisé à l'exécution (installé avec pip, non inclus)", "Zur Laufzeit verwendet (per pip installiert, nicht enthalten)", "Se usa en tiempo de ejecución (instalado con pip, no incluido)"],
  full_text:  ["全文", "Full text", "全文", "전문", "Texte intégral", "Volltext", "Texto completo"],
};

export const UI_CODES = UI_LANGS.map(([c]) => c);

function pickUiLang() {
  const saved = store.get("plamo.ui", "");
  if (UI_CODES.includes(saved)) return saved;
  for (const l of navigator.languages || [navigator.language || ""]) {
    const c = String(l).toLowerCase().split("-")[0];
    if (UI_CODES.includes(c)) return c;
  }
  return "en";
}

// 現在の表示言語（他のモジュールからはライブバインディングで参照する）
export let ui = pickUiLang();
let idx = UI_CODES.indexOf(ui);
export let locale = UI_LANGS[idx][2];
export let nf = new Intl.NumberFormat(locale);

export function t(key, params = {}) {
  const row = I18N[key];
  let s = row ? (row[idx] ?? row[1]) : key;
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(v);
  return s;
}

// 翻訳できる言語（PLaMo 3 Translate の対応 53 言語。コードはモデルカードの「対応言語」の表のとおり）
// 名前は Intl.DisplayNames で表示言語に合わせる（使えなければ日本語名）
const JA_NAMES = {
  ja: "日本語", en: "英語", "zh-hans": "中国語（簡体字）", "zh-hant": "中国語（繁体字）", ko: "韓国語",
  ar: "アラビア語", az: "アゼルバイジャン語", be: "ベラルーシ語", bg: "ブルガリア語", bn: "ベンガル語",
  ca: "カタルーニャ語", ceb: "セブアノ語", de: "ドイツ語", es: "スペイン語", et: "エストニア語",
  eu: "バスク語", fa: "ペルシャ語", fr: "フランス語", gu: "グジャラート語", he: "ヘブライ語",
  hi: "ヒンディー語", hr: "クロアチア語", hu: "ハンガリー語", hy: "アルメニア語", id: "インドネシア語",
  it: "イタリア語", jv: "ジャワ語", ka: "ジョージア語", kk: "カザフ語", km: "クメール語",
  lt: "リトアニア語", lv: "ラトビア語", ml: "マラヤーラム語", mr: "マラーティー語", ms: "マレー語",
  my: "ミャンマー語", ne: "ネパール語", nl: "オランダ語", pa: "パンジャーブ語", pl: "ポーランド語",
  ru: "ロシア語", si: "シンハラ語", sk: "スロバキア語", sl: "スロベニア語", sr: "セルビア語",
  sw: "スワヒリ語", ta: "タミル語", te: "テルグ語", th: "タイ語", tl: "タガログ語",
  ur: "ウルドゥー語", uz: "ウズベク語", vi: "ベトナム語",
};
const PINNED = ["ja", "en", "zh-hans", "zh-hant", "ko"];   // 一覧の先頭に固定（残りは表示言語での名前順）
const ALL_CODES = Object.keys(JA_NAMES);
export const RTL_LANGS = new Set(["ar", "fa", "he", "ur"]);
export const isLangCode = (code) => Object.hasOwn(JA_NAMES, code);

export let LANG_CODES = ALL_CODES;   // 一覧に並べる順（表示言語が変わると並べ直す）
let names = {};
function buildNames() {
  let dn = null;
  try { dn = new Intl.DisplayNames([locale], { type: "language" }); } catch { /* 古いブラウザ */ }
  names = Object.fromEntries(ALL_CODES.map((c) => {
    let n = null;
    try { n = dn?.of(c); } catch { /* 知らないコード */ }
    if (!n || n.toLowerCase() === c) return [c, JA_NAMES[c]];   // 名前が無ければ日本語名
    if (ui !== "ja") n = n.charAt(0).toLocaleUpperCase(locale) + n.slice(1);   // français → Français
    return [c, n];
  }));
  const coll = new Intl.Collator(locale);
  const rest = ALL_CODES.filter((c) => !PINNED.includes(c)).sort((a, b) => coll.compare(names[a], names[b]));
  LANG_CODES = [...PINNED, ...rest];
}
buildNames();
export const langName = (code) => names[code] ?? code;

// <html lang> は CSS の :lang() による書体の切り替えにも使う
// （"zh" は表示言語の簡体中文、"zh-hans" / "zh-hant" は翻訳先の中国語）
const HTML_LANG = { zh: "zh-CN", "zh-hans": "zh-Hans", "zh-hant": "zh-Hant" };
export const htmlLang = (code) => HTML_LANG[code] ?? code;

const listeners = [];
export const onUiLangChange = (fn) => listeners.push(fn);

export function setUiLang(code) {
  if (!UI_CODES.includes(code)) return;
  ui = code;
  idx = UI_CODES.indexOf(code);
  locale = UI_LANGS[idx][2];
  nf = new Intl.NumberFormat(locale);
  store.set("plamo.ui", code);
  buildNames();
  for (const fn of listeners) fn();
}

// data-i18n（テキスト）/ data-i18n-attr（"属性:キー,属性:キー"）の付いた要素を差し替える
export function applyStatic(params = {}) {
  document.documentElement.lang = htmlLang(ui);
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n, params);
  for (const el of document.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(",")) {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr, t(key, params));
    }
  }
}
