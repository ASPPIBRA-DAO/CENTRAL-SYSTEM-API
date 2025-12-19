import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// === CONFIGURAÇÕES GLOBAIS ===
const OUTPUT_FILE = 'AUDITORIA_GERAL_ARQUITETURA.md';
const __filename = fileURLToPath(import.meta.url);
const SCRIPT_NAME = path.basename(__filename);
const ROOT_DIR = process.cwd();

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.idx', '.vscode', 'migrations'];

// Arquivos Críticos de Identificação (Full Stack)
const CRITICAL_FILES = [
    // Core & Tooling
    'package.json',
    'tsconfig.json',
    'README.md',
    '.gitignore',
    '.dev.vars',
    '.env',
    // Backend / Workers
    'wrangler.jsonc',
    'wrangler.toml',
    'drizzle.config.ts',
    'src/index.ts',
    // Frontend / Vite
    'vite.config.ts',
    'index.html',
    'tailwind.config.js',
    'src/main.tsx'
];

let report = {
    nature: 'Desconhecida',
    tree: '',
    configs: '',
    security: '',
    todos: '',
    health: {
        hasDrizzle: false,
        hasAuth: false,
        hasCloudflare: false,
        hasVite: false
    }
};

// 1. DETECÇÃO DE NATUREZA DO PROJETO
function detectNature() {
    const pkgPath = path.join(ROOT_DIR, 'package.json');
    if (!fs.existsSync(pkgPath)) return 'Pasta sem package.json';

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const allDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);

    if (allDeps['hono'] || fs.existsSync(path.join(ROOT_DIR, 'wrangler.jsonc'))) {
        report.nature = 'Backend (Cloudflare Worker / Hono)';
        report.health.hasCloudflare = true;
    } else if (allDeps['vite'] || allDeps['react']) {
        report.nature = 'Frontend (Vite / React)';
        report.health.hasVite = true;
    }
    
    if (allDeps['drizzle-orm']) report.health.hasDrizzle = true;
    if (allDeps['bcryptjs'] || allDeps['jsonwebtoken'] || allDeps['siwe']) report.health.hasAuth = true;

    return report.nature;
}

// 2. GERADOR DE ÁRVORE (Com inteligência de profundidade)
function generateTree(dir, prefix = '', depth = 0) {
    if (depth > 4) return prefix + '└── ... (limite de profundidade)\\n';
    let output = '';
    let files;
    try { files = fs.readdirSync(dir); } catch (e) { return ''; }

    const filtered = files.filter(f => !IGNORE_DIRS.includes(f) && f !== SCRIPT_NAME && f !== OUTPUT_FILE);
    
    filtered.forEach((file, index) => {
        const isLast = index === filtered.length - 1;
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        const marker = isLast ? '└── ' : '├── ';
        
        output += prefix + marker + file + (stats.isDirectory() ? '/' : '') + '\\n';
        if (stats.isDirectory()) {
            output += generateTree(filePath, prefix + (isLast ? '    ' : '│   '), depth + 1);
        }
    });
    return output;
}

// 3. ANÁLISE DE ARQUIVOS CRÍTICOS
function analyzeFiles() {
    let out = '\\n## ⚙️ ANÁLISE DE CONFIGURAÇÃO\\n';
    CRITICAL_FILES.forEach(file => {
        const fullPath = path.join(ROOT_DIR, file);
        if (fs.existsSync(fullPath)) {
            out += `### ✅ ${file}\\n`;
            if (file.indexOf('.env') === -1 && file.indexOf('.vars') === -1) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                out += '```' + (file.endsWith('.ts') ? 'typescript' : 'json') + '\\n';
                out += content.length > 1500 ? content.substring(0, 1500) + '\\n... (truncado)' : content;
                out += '\\n```\\n';
            } else {
                out += '`Arquivo de ambiente detectado (Conteúdo oculto por segurança)`\\n';
            }
        }
    });
    return out;
}

// 4. SCANNER DE DÍVIDA TÉCNICA
function scanTodos(dir) {
    let out = '';
    let files;
    try { files = fs.readdirSync(dir); } catch { return ''; }

    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (IGNORE_DIRS.includes(file)) return;

        if (fs.statSync(filePath).isDirectory()) {
            out += scanTodos(filePath);
        } else if (file.match(/\\.(ts|tsx|js|jsx)$/)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\\n');
            lines.forEach((line, idx) => {
                if (line.indexOf('TODO') !== -1 || line.indexOf('FIXME') !== -1) {
                    const rel = path.relative(ROOT_DIR, filePath);
                    out += `- [ ] **${rel}:${idx + 1}**: \`${line.trim()}\`\\n`;
                }
            });
        }
    });
    return out;
}

// === EXECUÇÃO ===
console.log("🚀 Iniciando Auditoria de Arquitetura ASPPIBRA...");

const nature = detectNature();
let md = `# 🕵️ RELATÓRIO DE ARQUITETURA - GOVERNANCE SYSTEM
**Data:** ${new Date().toLocaleString()}
**Natureza Detectada:** ${nature}
**Diretório:** \`${ROOT_DIR}\`

---

## 🏗️ ESTADO DA TECNOLOGIA
- **Banco de Dados (Drizzle):** ${report.health.hasDrizzle ? '✅ Implementado' : '❌ Ausente'}
- **Autenticação/Segurança:** ${report.health.hasAuth ? '🛡️ Configurada' : '⚠️ Não detectada'}
- **Infraestrutura Cloudflare:** ${report.health.hasCloudflare ? '☁️ Ativa (Worker/D1/R2)' : '💻 Tradicional'}
- **Interface Frontend:** ${report.health.hasVite ? '⚛️ React/Vite' : '🔌 Somente API'}

---

## 🌳 ESTRUTURA DE DIRETÓRIOS
\`\`\`text
${generateTree(ROOT_DIR)}
\`\`\`

${analyzeFiles()}

## 📝 DÍVIDA TÉCNICA E TAREFAS (TODOs)
${scanTodos(ROOT_DIR) || '✅ Nenhum TODO pendente encontrado.'}

---
*Gerado automaticamente pelo Auditor de Arquitetura v4.*
`;

fs.writeFileSync(path.join(ROOT_DIR, OUTPUT_FILE), md);
console.log(`✅ Auditoria finalizada! Relatório gerado: ${OUTPUT_FILE}`);