const fs = require('fs');
const path = require('path');

// CONFIGURAÇÕES
const OUTPUT_FILE = 'RELATORIO_ARQUITETURA.md';
const IGNORE_DIRS = ['node_modules', '.git', '.wrangler', 'dist', '.cache', '.DS_Store'];
const CRITICAL_FILES = ['wrangler.jsonc', 'wrangler.toml', 'package.json', 'drizzle.config.ts', 'tsconfig.json', 'src/types/bindings.d.ts'];
const ROOT_DIR = process.cwd();

let reportContent = `# 🕵️ RELATÓRIO DE AUDITORIA - CENTRAL-SYSTEM-API
Data: ${new Date().toLocaleString()}
Diretório Raiz: ${ROOT_DIR}

---

`;

// 1. FUNÇÃO PARA GERAR ÁRVORE DE DIRETÓRIOS
function generateTree(dir, prefix = '') {
    let output = '';
    const files = fs.readdirSync(dir);
    
    // Filtra e ordena (pastas primeiro)
    const filteredFiles = files.filter(f => !IGNORE_DIRS.includes(f));
    filteredFiles.sort((a, b) => {
        const aStat = fs.statSync(path.join(dir, a));
        const bStat = fs.statSync(path.join(dir, b));
        if (aStat.isDirectory() && !bStat.isDirectory()) return -1;
        if (!aStat.isDirectory() && bStat.isDirectory()) return 1;
        return a.localeCompare(b);
    });

    filteredFiles.forEach((file, index) => {
        const isLast = index === filteredFiles.length - 1;
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        
        const marker = isLast ? '└── ' : '├── ';
        output += `${prefix}${marker}${file}${stats.isDirectory() ? '/' : ''}\\n`;
        
        if (stats.isDirectory()) {
            const newPrefix = prefix + (isLast ? '    ' : '│   ');
            output += generateTree(filePath, newPrefix);
        }
    });
    return output;
}

// 2. FUNÇÃO PARA LER ARQUIVOS CRÍTICOS
function readCriticalFiles() {
    let output = '\\n## 2. ⚙️ CONFIGURAÇÕES CRÍTICAS\\n';
    
    CRITICAL_FILES.forEach(file => {
        const fullPath = path.join(ROOT_DIR, file);
        if (fs.existsSync(fullPath)) {
            output += '\\n### 📄 ' + file + '\\n```jsonc\\n';
            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                output += content;
            } catch (e) {
                output += `[Erro ao ler arquivo: ${e.message}]`;
            }
            output += '\\n```\\n';
        } else {
            output += `\\n### ❌ ${file} (Não encontrado)\\n`;
        }
    });
    return output;
}

// 3. VERIFICAÇÃO DE SEGURANÇA E AMBIENTE
function checkEnvironment() {
    let output = '\\n## 3. 🛡️ VERIFICAÇÃO DE AMBIENTE E SEGURANÇA\\n';
    
    const envFile = path.join(ROOT_DIR, '.dev.vars');
    const gitIgnore = path.join(ROOT_DIR, '.gitignore');
    
    output += `- **.dev.vars**: ${fs.existsSync(envFile) ? '✅ Existe (OK)' : '⚠️ NÃO ENCONTRADO (Crítico para dev local)'}\\n`;
    
    if (fs.existsSync(gitIgnore)) {
        const content = fs.readFileSync(gitIgnore, 'utf-8');
        const ignoresVars = content.includes('.dev.vars');
        output += `- **.gitignore**: ✅ Existe. \\n  - Ignora .dev.vars? ${ignoresVars ? '✅ Sim' : '⚠️ NÃO (Risco de vazamento de credenciais!)'}\\n`;
    } else {
        output += '- **.gitignore**: ⚠️ NÃO ENCONTRADO\\n';
    }

    return output;
}

// 4. SCANNER DE DÍVIDA TÉCNICA (TODOs)
function scanForTodos(dir) {
    let output = '';
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (IGNORE_DIRS.includes(file)) return;

        if (stats.isDirectory()) {
            output += scanForTodos(filePath);
        } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.jsonc')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\\n');
            lines.forEach((line, index) => {
                if (line.includes('TODO') || line.includes('FIXME')) {
                    const relativePath = path.relative(ROOT_DIR, filePath);
                    output += `- [ ] **${relativePath}:${index + 1}**: \\\`${line.trim()}\\\`\\n`;
                }
            });
        }
    });
    return output;
}

// === EXECUÇÃO ===
console.log("🔍 Iniciando auditoria do projeto...");

// Bloco 1: Árvore
reportContent += '## 1. 🌳 ESTRUTURA DE ARQUIVOS\\n```text\\n' + generateTree(ROOT_DIR) + '\\n```\\n';

// Bloco 2: Configs
reportContent += readCriticalFiles();

// Bloco 3: Segurança
reportContent += checkEnvironment();

// Bloco 4: TODOs
const todos = scanForTodos(ROOT_DIR);
reportContent += '\\n## 4. 📝 DÍVIDA TÉCNICA (TODOs/FIXMEs)\\n' + (todos ? todos : 'Nenhum TODO encontrado. Código limpo!') + '\\n';

// Salvar
fs.writeFileSync(path.join(ROOT_DIR, OUTPUT_FILE), reportContent);
console.log(`✅ Relatório gerado com sucesso: ${OUTPUT_FILE}`);
console.log(`👉 Abra o arquivo ${OUTPUT_FILE} e copie o conteúdo aqui para análise.`);