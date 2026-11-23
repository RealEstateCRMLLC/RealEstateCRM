/**
 * Universal CRM platform layer: languages, add-ons, tenant branding.
 * Custom add-ons are built and published by United Beats LLC (Bob & Lum).
 * HyperNexus drives the harness: automations, AI, sync, and workflows run
 * identically in every sector — only the pack configuration changes.
 */
export interface Language {
  code: string;
  label: string;
  native: string;
  rtl?: boolean;
}

export const LANGUAGES: Language[] = [
  { code: "en", label: "English", native: "English" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "nl", label: "Dutch", native: "Nederlands" },
  { code: "pl", label: "Polish", native: "Polski" },
  { code: "ar", label: "Arabic", native: "العربية", rtl: true },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "zh", label: "Chinese (Simplified)", native: "简体中文" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "ru", label: "Russian", native: "Русский" },
  { code: "tr", label: "Turkish", native: "Türkçe" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
];

export function getLanguage(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/**
 * Core UI dictionary covering all 16 launch languages.
 * Every Universal CRM shell label resolves through `t(lang, key)` so adding a
 * language or switching a workspace's locale never requires a component rewrite.
 */
export const REQUIRED_STRING_KEYS = [
  "welcome",
  "customers",
  "pipeline",
  "getStarted",
  "tagline",
  "provisionWorkspace",
  "activeSector",
  "complianceGuardrails",
  "templatesReady",
  "monthlyAddOns",
] as const;

export type UniversalStringKey = (typeof REQUIRED_STRING_KEYS)[number];

export const STRINGS: Record<string, Record<string, string>> = {
  en: {
    welcome: "Welcome",
    customers: "Customers",
    pipeline: "Pipeline",
    getStarted: "Get started",
    tagline: "Every business. One harness.",
    provisionWorkspace: "Provision workspace",
    activeSector: "Active sector pack",
    complianceGuardrails: "Compliance guardrails",
    templatesReady: "Starter templates",
    monthlyAddOns: "Monthly add-ons",
  },
  es: {
    welcome: "Bienvenido",
    customers: "Clientes",
    pipeline: "Embudo",
    getStarted: "Comenzar",
    tagline: "Cada negocio. Un solo sistema.",
    provisionWorkspace: "Configurar espacio",
    activeSector: "Sector activo",
    complianceGuardrails: "Controles de cumplimiento",
    templatesReady: "Plantillas listas",
    monthlyAddOns: "Complementos mensuales",
  },
  fr: {
    welcome: "Bienvenue",
    customers: "Clients",
    pipeline: "Pipeline",
    getStarted: "Commencer",
    tagline: "Chaque entreprise. Un seul système.",
    provisionWorkspace: "Configurer l'espace",
    activeSector: "Secteur actif",
    complianceGuardrails: "Règles de conformité",
    templatesReady: "Modèles prêts",
    monthlyAddOns: "Modules mensuels",
  },
  de: {
    welcome: "Willkommen",
    customers: "Kunden",
    pipeline: "Pipeline",
    getStarted: "Loslegen",
    tagline: "Jedes Unternehmen. Ein System.",
    provisionWorkspace: "Arbeitsbereich einrichten",
    activeSector: "Aktives Branchenpaket",
    complianceGuardrails: "Compliance-Richtlinien",
    templatesReady: "Startvorlagen",
    monthlyAddOns: "Monatliche Add-ons",
  },
  pt: {
    welcome: "Bem-vindo",
    customers: "Clientes",
    pipeline: "Funil",
    getStarted: "Começar",
    tagline: "Cada negócio. Um só sistema.",
    provisionWorkspace: "Configurar espaço",
    activeSector: "Pacote do setor",
    complianceGuardrails: "Regras de conformidade",
    templatesReady: "Modelos prontos",
    monthlyAddOns: "Extras mensais",
  },
  it: {
    welcome: "Benvenuto",
    customers: "Clienti",
    pipeline: "Pipeline",
    getStarted: "Inizia ora",
    tagline: "Ogni impresa. Un solo sistema.",
    provisionWorkspace: "Configura spazio",
    activeSector: "Settore attivo",
    complianceGuardrails: "Regole di conformità",
    templatesReady: "Modelli pronti",
    monthlyAddOns: "Componenti mensili",
  },
  nl: {
    welcome: "Welkom",
    customers: "Klanten",
    pipeline: "Pijplijn",
    getStarted: "Aan de slag",
    tagline: "Elk bedrijf. Één systeem.",
    provisionWorkspace: "Werkruimte inrichten",
    activeSector: "Actief sectorpakket",
    complianceGuardrails: "Compliance-regels",
    templatesReady: "Standaardsjablonen",
    monthlyAddOns: "Maandelijkse uitbreidingen",
  },
  pl: {
    welcome: "Witamy",
    customers: "Klienci",
    pipeline: "Lejek",
    getStarted: "Rozpocznij",
    tagline: "Każda firma. Jeden system.",
    provisionWorkspace: "Skonfiguruj przestrzeń",
    activeSector: "Aktywny pakiet branżowy",
    complianceGuardrails: "Zasady zgodności",
    templatesReady: "Gotowe szablony",
    monthlyAddOns: "Dodatki miesięczne",
  },
  ar: {
    welcome: "مرحباً",
    customers: "العملاء",
    pipeline: "خط الأنابيب",
    getStarted: "ابدأ الآن",
    tagline: "كل عمل. نظام واحد.",
    provisionWorkspace: "تهيئة مساحة العمل",
    activeSector: "حزمة القطاع النشطة",
    complianceGuardrails: "ضوابط الامتثال",
    templatesReady: "قوالب جاهزة",
    monthlyAddOns: "إضافات شهرية",
  },
  hi: {
    welcome: "स्वागत है",
    customers: "ग्राहक",
    pipeline: "पाइपलाइन",
    getStarted: "शुरू करें",
    tagline: "हर व्यवसाय। एक प्रणाली।",
    provisionWorkspace: "कार्यक्षेत्र सेट करें",
    activeSector: "सक्रिय सेक्टर पैक",
    complianceGuardrails: "अनुपालन नियम",
    templatesReady: "तैयार टेम्पलेट",
    monthlyAddOns: "मासिक ऐड-ऑन",
  },
  zh: {
    welcome: "欢迎",
    customers: "客户",
    pipeline: "管道",
    getStarted: "开始使用",
    tagline: "每个企业。一个系统。",
    provisionWorkspace: "配置工作区",
    activeSector: "当前行业包",
    complianceGuardrails: "合规护栏",
    templatesReady: "预设模板",
    monthlyAddOns: "月度扩展模块",
  },
  ja: {
    welcome: "ようこそ",
    customers: "顧客",
    pipeline: "パイプライン",
    getStarted: "はじめる",
    tagline: "すべての事業に、ひとつの基盤を。",
    provisionWorkspace: "ワークスペース設定",
    activeSector: "有効な業種パック",
    complianceGuardrails: "コンプライアンス指針",
    templatesReady: "初期テンプレート",
    monthlyAddOns: "月額アドオン",
  },
  ko: {
    welcome: "환영합니다",
    customers: "고객",
    pipeline: "파이프라인",
    getStarted: "시작하기",
    tagline: "모든 비즈니스. 하나의 시스템.",
    provisionWorkspace: "워크스페이스 구성",
    activeSector: "활성 업종 팩",
    complianceGuardrails: "규정 준수 가이드",
    templatesReady: "기본 템플릿",
    monthlyAddOns: "월간 애드온",
  },
  ru: {
    welcome: "Добро пожаловать",
    customers: "Клиенты",
    pipeline: "Воронка",
    getStarted: "Начать",
    tagline: "Любой бизнес. Единая платформа.",
    provisionWorkspace: "Настроить пространство",
    activeSector: "Активный отраслевой пакет",
    complianceGuardrails: "Правила соответствия",
    templatesReady: "Готовые шаблоны",
    monthlyAddOns: "Ежемесячные модули",
  },
  tr: {
    welcome: "Hoş geldiniz",
    customers: "Müşteriler",
    pipeline: "Satış Hattı",
    getStarted: "Başlayın",
    tagline: "Her işletme. Tek altyapı.",
    provisionWorkspace: "Çalışma alanını kur",
    activeSector: "Aktif sektör paketi",
    complianceGuardrails: "Uyum kuralları",
    templatesReady: "Hazır şablonlar",
    monthlyAddOns: "Aylık eklentiler",
  },
  vi: {
    welcome: "Chào mừng",
    customers: "Khách hàng",
    pipeline: "Quy trình",
    getStarted: "Bắt đầu",
    tagline: "Mọi doanh nghiệp. Một nền tảng.",
    provisionWorkspace: "Thiết lập không gian",
    activeSector: "Gói ngành đang dùng",
    complianceGuardrails: "Quy tắc tuân thủ",
    templatesReady: "Mẫu sẵn có",
    monthlyAddOns: "Tiện ích hàng tháng",
  },
};

export function t(lang: string, key: string): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}

export interface AddOn {
  id: string;
  name: string;
  blurb: string;
  priceMonthly: number;
  sectors: string[] | "all";
  byUnitedBeats: true;
}

export const ADD_ONS: AddOn[] = [
  { id: "ai-receptionist", name: "AI Receptionist (HyperNexus Voice)", blurb: "Answers, qualifies, and books in every language, 24/7.", priceMonthly: 149, sectors: "all", byUnitedBeats: true },
  { id: "trust-tsf", name: "Trust, Security & Future (TSF)", blurb: "Trust documents, taught course, and done-with-you assembly.", priceMonthly: 0, sectors: ["real-estate", "legal", "finance"], byUnitedBeats: true },
  { id: "review-engine", name: "Review & Referral Engine", blurb: "Automatic review requests and referral campaigns after every win.", priceMonthly: 49, sectors: "all", byUnitedBeats: true },
  { id: "smart-scheduling", name: "Smart Scheduling & Routes", blurb: "Calendars, dispatch, and route planning for field teams.", priceMonthly: 79, sectors: ["construction", "home-services", "healthcare", "hospitality", "roofing", "carpentry", "masonry", "landscaping", "manufacturing"], byUnitedBeats: true },
  { id: "commerce-sync", name: "Commerce Sync", blurb: "Orders, carts, and inventory synced into the pipeline.", priceMonthly: 99, sectors: ["retail", "ecommerce", "discount-retail"], byUnitedBeats: true },
  { id: "compliance-vault", name: "Compliance Vault", blurb: "Sector checklists, disclosures, and audit trails, always on.", priceMonthly: 129, sectors: ["healthcare", "legal", "finance", "tech-saas"], byUnitedBeats: true },
  { id: "digital-team", name: "Digital Second Team (AI Agents)", blurb: "A 5-agent digital workforce: Concierge, Revenue, Dispatch, Oracle, and Truth Consultant.", priceMonthly: 199, sectors: "all", byUnitedBeats: true },
  { id: "market-oracle", name: "Market Oracle & Business Truth", blurb: "Hyper-local geo demand, competitor intelligence, and unvarnished growth modeling.", priceMonthly: 149, sectors: "all", byUnitedBeats: true },
];

export interface TenantBrand {
  businessName: string;
  sectorId: string;
  language: string;
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
  poweredBy: "United Beats LLC (Bob & Lum) — Universal CRM on HyperNexus";
}

export function addOnsForSector(sectorId: string): AddOn[] {
  return ADD_ONS.filter((a) => a.sectors === "all" || a.sectors.includes(sectorId));
}

export function calculateAddOnSelection(
  sectorId: string,
  requestedAddOnIds: readonly string[],
): { enabledAddOns: AddOn[]; monthlyTotal: number } {
  const compatible = addOnsForSector(sectorId);
  const requestedSet = new Set(requestedAddOnIds);
  const enabledAddOns = compatible.filter((a) => requestedSet.has(a.id));
  const monthlyTotal = enabledAddOns.reduce((sum, a) => sum + a.priceMonthly, 0);
  return { enabledAddOns, monthlyTotal };
}
