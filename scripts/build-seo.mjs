import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- CONFIGURAÇÃO DE AMBIENTE (ES Modules) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================
// 1. CONFIGURATION (Global Web3 Standard)
// =========================================================
const CONFIG = {
  domain: process.env.PUBLIC_URL || "https://api.asppibra.com",
  appName: "ASPPIBRA Governance",
  appShortName: "ASPPIBRA",
  
  // ✅ ATUALIZADO: Descrição em Inglês Técnico (Web3)
  appDescription: "Real-time telemetry and observability of ASPPIBRA DAO's decentralized infrastructure.",
  
  themeColor: "#1A1A2E",
  backgroundColor: "#1A1A2E",
  
  // Caminhos (Script em /scripts -> sobe um e entra em public)
  publicDir: path.join(__dirname, "../public"),
};

// ✅ ESTRATÉGIA SEGURA: Indexar APENAS a URL Raiz
const PUBLIC_PAGES = [
  { url: "/", priority: "1.0", freq: "always" },
];

// =========================================================
// 2. CONTENT GENERATORS
// =========================================================

// ✅ ATUALIZADO: Comentários em Inglês e Regras de Segurança
const getRobotsTxt = () => `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /
Allow: /site.webmanifest
Allow: /favicon.ico

# Security: Block ALL Internal API Routes
Disallow: /monitoring
Disallow: /health-db
Disallow: /users/
Disallow: /auth/
Disallow: /post/
# Wildcard safety net
Disallow: /api/*

# System Files & Config
Disallow: /wrangler.toml
Disallow: /wrangler.jsonc
Disallow: /package.json
Disallow: /node_modules/
Disallow: *.ts

# Sitemap Location
Sitemap: ${CONFIG.domain}/sitemap.xml
`;

const getManifest = () => ({
  name: CONFIG.appName,
  short_name: CONFIG.appShortName,
  description: CONFIG.appDescription,
  start_url: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: CONFIG.backgroundColor,
  theme_color: CONFIG.themeColor,
  icons: [
    { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
  ],
  categories: ["productivity", "utilities", "governance"]
});

// =========================================================
// 3. EXECUTION
// =========================================================

console.log(`\n🚀 STARTING SECURE SEO BUILD [${CONFIG.appName}]`);

try {
  // Garante o diretório
  if (!fs.existsSync(CONFIG.publicDir)) {
    fs.mkdirSync(CONFIG.publicDir, { recursive: true });
  }

  // 1. Robots.txt
  fs.writeFileSync(path.join(CONFIG.publicDir, "robots.txt"), getRobotsTxt());
  console.log("   ✅ Robots.txt generated (Security Rules Applied)");

  // 2. Manifest.json
  fs.writeFileSync(
    path.join(CONFIG.publicDir, "site.webmanifest"), 
    JSON.stringify(getManifest(), null, 2)
  );
  console.log("   ✅ Manifest PWA generated");

  // 3. Sitemap.xml (ROOT ONLY - Sem expor rotas internas)
  const today = new Date().toISOString().split("T")[0];
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PUBLIC_PAGES.map(p => `  <url>
    <loc>${CONFIG.domain}${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n")}
</urlset>`;
  
  fs.writeFileSync(path.join(CONFIG.publicDir, "sitemap.xml"), sitemap);
  console.log(`   ✅ Sitemap XML generated (Root only - Secure)`);

} catch (e) {
  console.error("\n❌ FATAL BUILD ERROR:", e);
  process.exit(1);
}

// =========================================================
// 4. AUDIT
// =========================================================
console.log("\n🔍 Auditing Assets...");
const requiredFiles = [
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "favicon.ico",
  "social-preview.png" // Garante que o banner do WhatsApp existe
];

let missing = 0;
requiredFiles.forEach(file => {
  if (!fs.existsSync(path.join(CONFIG.publicDir, file))) {
    console.error(`   ❌ [FAIL] Missing file: ${file}`);
    missing++;
  } else {
    console.log(`   ok: ${file}`);
  }
});

if (missing > 0) {
  console.error(`\n⚠️  WARNING: ${missing} vital assets are missing!`);
  // process.exit(1); // Descomente se quiser bloquear o deploy em caso de erro
} else {
  console.log("\n✨ SUCCESS. System ready for deploy.\n");
}