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
  // Se não houver variável de ambiente, usa a produção
  domain: process.env.PUBLIC_URL || "https://api.asppibra.com",
  
  appName: "ASPPIBRA Governance",
  appShortName: "ASPPIBRA",
  appDescription: "Real-time telemetry and observability of ASPPIBRA DAO's decentralized infrastructure.",
  
  // ✅ ATUALIZADO: Novas cores do tema (Dark Blue)
  themeColor: "#020617",
  backgroundColor: "#020617",
  
  // Caminhos Absolutos
  publicDir: path.join(__dirname, "../public"),
};

// Páginas para Indexação (Sitemap)
const PUBLIC_PAGES = [
  { url: "/", priority: "1.0", freq: "always" },
];

// =========================================================
// 2. SMART CONTENT GENERATORS
// =========================================================

const getRobotsTxt = () => `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# ✅ Security: Explicitly Allow Static Assets
Allow: /css/
Allow: /js/
Allow: /img/
Allow: /icons/
Allow: /site.webmanifest
Allow: /favicon.ico

# ⛔ Security: Block Internal API & System Routes
Disallow: /api/
Disallow: /monitoring
Disallow: /health-db
Disallow: /users/
Disallow: /auth/

# ⛔ Block System Files
Disallow: /wrangler.toml
Disallow: /wrangler.jsonc
Disallow: /package.json
Disallow: /node_modules/
Disallow: *.ts
Disallow: *.map

# Sitemap Location
Sitemap: ${CONFIG.domain}/sitemap.xml
`;

// ✅ ATUALIZADO: Caminhos apontando para /icons/
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
    { 
      src: "/icons/android-chrome-192x192.png", 
      sizes: "192x192", 
      type: "image/png" 
    },
    { 
      src: "/icons/android-chrome-512x512.png", 
      sizes: "512x512", 
      type: "image/png" 
    }
  ],
  categories: ["productivity", "utilities", "governance"]
});

// =========================================================
// 3. EXECUTION ENGINE
// =========================================================

console.log(`\n🚀 STARTING INTELLIGENT SEO BUILD [${CONFIG.appName}]`);
console.log(`   📂 Target: ${CONFIG.publicDir}`);

try {
  // 1. Garante que a pasta public existe
  if (!fs.existsSync(CONFIG.publicDir)) {
    fs.mkdirSync(CONFIG.publicDir, { recursive: true });
  }

  // 2. Gera Robots.txt
  fs.writeFileSync(path.join(CONFIG.publicDir, "robots.txt"), getRobotsTxt());
  console.log("   ✅ Robots.txt generated (Updated Rules)");

  // 3. Gera Manifest PWA
  fs.writeFileSync(
    path.join(CONFIG.publicDir, "site.webmanifest"), 
    JSON.stringify(getManifest(), null, 2)
  );
  console.log("   ✅ Site.webmanifest generated (New Icon Paths & Colors)");

  // 4. Gera Sitemap.xml
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
  console.log(`   ✅ Sitemap XML generated`);

} catch (e) {
  console.error("\n❌ FATAL BUILD ERROR:", e);
  process.exit(1);
}

// =========================================================
// 4. SMART AUDIT (New Architecture Aware)
// =========================================================
console.log("\n🔍 Auditing Static Assets (New Structure)...");

// Mapeamento Inteligente: Arquivo -> Subpasta esperada
const assetsToCheck = [
  { file: "favicon.ico", folder: "" }, // Raiz
  { file: "robots.txt", folder: "" },
  { file: "sitemap.xml", folder: "" },
  { file: "site.webmanifest", folder: "" },
  
  // Imagens Sociais
  { file: "social-preview.png", folder: "img" },
  
  // Ícones do App
  { file: "android-chrome-192x192.png", folder: "icons" },
  { file: "android-chrome-512x512.png", folder: "icons" },
  { file: "apple-touch-icon.png", folder: "icons" },
  { file: "favicon-16x16.png", folder: "icons" },
  { file: "favicon-32x32.png", folder: "icons" },
  
  // Estilos e Scripts (Básico)
  { file: "style.css", folder: "css" },
  { file: "dashboard.js", folder: "js" }
];

let missingCount = 0;

assetsToCheck.forEach(asset => {
  // Constrói o caminho: public + folder + file
  const fullPath = path.join(CONFIG.publicDir, asset.folder, asset.file);
  const displayPath = asset.folder ? `/${asset.folder}/${asset.file}` : `/${asset.file}`;

  if (!fs.existsSync(fullPath)) {
    console.error(`   ❌ [MISSING] ${displayPath}`);
    missingCount++;
  } else {
    // Check extra: Se for arquivo vazio
    const stats = fs.statSync(fullPath);
    if (stats.size === 0) {
      console.warn(`   ⚠️  [EMPTY]   ${displayPath}`);
    } else {
      console.log(`   🆗 [FOUND]   ${displayPath}`);
    }
  }
});

console.log("-".repeat(40));

if (missingCount > 0) {
  console.error(`\n⚠️  WARNING: ${missingCount} assets are missing or in the wrong place!`);
  console.error(`   Please run the organization commands again or check 'public' folder.\n`);
  process.exit(1); // Falha o build se faltar coisa essencial
} else {
  console.log("\n✨ SYSTEM INTEGRITY: 100%. Ready for Global Deploy.\n");
}