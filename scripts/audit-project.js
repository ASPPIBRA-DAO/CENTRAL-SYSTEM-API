const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const REPORT_DATE = new Date().toLocaleString();

const REQUIRED_FILES = [
    'src/db/schema.ts',
    'src/services/auth.ts',
    'src/routes/core/auth/index.ts',
    'src/routes/core/auth/password.ts',
    'src/validators/auth.ts',
    'src/utils/auth-guard.ts',
    'src/services/email.ts'
];

const REQUIRED_DEPS = ['hono', 'drizzle-orm', 'argon2', 'zod'];
const REQUIRED_ENV = ['JWT_SECRET', 'DB'];

function runAudit() {
    console.log('\n🕵️  AUDITORIA DE SISTEMA: GOVERNANCE SYSTEM API (v3.2)');
    console.log('📅 Relatório gerado em: ' + REPORT_DATE + '\n');

    let report = {
        files: { ok: [], missing: [], alerts: [] },
        dependencies: { missing: [] },
        env: { missing: [] },
        todos: [],
        connections: { isMounted: false }
    };

    // 1. Auditoria de Arquivos
    REQUIRED_FILES.forEach(file => {
        const filePath = path.join(ROOT_DIR, file);
        if (fs.existsSync(filePath)) {
            report.files.ok.push(file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            if (file.indexOf('schema.ts') !== -1 && content.indexOf('Argon2id') !== -1) {
                const authSvcPath = path.join(ROOT_DIR, 'src/services/auth.ts');
                if (fs.existsSync(authSvcPath)) {
                    const authService = fs.readFileSync(authSvcPath, 'utf8');
                    if (authService.indexOf('argon2') === -1) {
                        report.files.alerts.push('⚠️ [CONFLITO] Schema cita Argon2id, mas AuthService não usa Argon2.');
                    }
                }
            }
        } else {
            report.files.missing.push(file);
        }
    });

    // 2. Auditoria de Dependências
    const pkgPath = path.join(ROOT_DIR, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const allDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
        REQUIRED_DEPS.forEach(dep => {
            if (!allDeps[dep]) report.dependencies.missing.push(dep);
        });
    }

    // 3. Auditoria de Ambiente
    const envPath = path.join(ROOT_DIR, '.dev.vars');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        REQUIRED_ENV.forEach(env => {
            if (envContent.indexOf(env) === -1) report.env.missing.push(env);
        });
    } else {
        report.env.missing.push('.dev.vars');
    }

    // 4. Auditoria de Conexão
    const indexPath = path.join(ROOT_DIR, 'src/index.ts');
    if (fs.existsSync(indexPath)) {
        const mainIndex = fs.readFileSync(indexPath, 'utf8');
        if (mainIndex.indexOf('core/auth') !== -1 || mainIndex.indexOf('authRoutes') !== -1) {
            report.connections.isMounted = true;
        }
    }

    // 5. Scanner de TODOs
    const srcPath = path.join(ROOT_DIR, 'src');
    if (fs.existsSync(srcPath)) {
        scanTodos(srcPath, report.todos);
    }

    printReport(report);
}

function scanTodos(dir, todoList) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanTodos(fullPath, todoList);
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.indexOf('TODO') !== -1 || line.indexOf('FIXME') !== -1) {
                    const cleanLine = line.replace('\r', '').trim();
                    todoList.push(path.relative(ROOT_DIR, fullPath) + ' (Linha ' + (idx + 1) + '): ' + cleanLine);
                }
            });
        }
    });
}

function printReport(r) {
    const divider = "---------------------------------------------------";
    console.log('📦 INFRAESTRUTURA');
    console.log('Arquivos: ' + r.files.ok.length + '/' + REQUIRED_FILES.length + ' OK');
    r.files.missing.forEach(f => console.log('  ❌ FALTANDO: ' + f));
    
    console.log('\n💉 DEPENDÊNCIAS');
    if (r.dependencies.missing.length === 0) {
        console.log('  ✅ Todas as libs instaladas.');
    } else {
        r.dependencies.missing.forEach(d => console.log('  ❌ REQUERIDO: ' + d));
    }

    console.log('\n🔑 AMBIENTE');
    if (r.env.missing.length === 0) {
        console.log('  ✅ Configurações completas.');
    } else {
        r.env.missing.forEach(e => console.log('  ❌ AUSENTE: ' + e));
    }

    console.log('\n🔗 CONECTIVIDADE');
    console.log(r.connections.isMounted ? '  ✅ Rotas montadas no index.ts' : '  🚨 ERRO: Rotas não detectadas!');

    if (r.files.alerts.length > 0) {
        console.log('\n⚠️  ALERTAS');
        r.files.alerts.forEach(a => console.log('  ' + a));
    }

    if (r.todos.length > 0) {
        console.log('\n📝 DÍVIDA TÉCNICA');
        r.todos.forEach(t => console.log('  👉 ' + t));
    }

    console.log('\n' + divider + '\n🌳 ÁRVORE SRC');
    console.log(generateTree(path.join(ROOT_DIR, 'src')));
}

function generateTree(dir, prefix = '') {
    let results = '';
    const list = fs.readdirSync(dir);
    list.forEach((file, index) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const isLast = index === list.length - 1;
        results += prefix + (isLast ? '└── ' : '├── ') + file + '\n';
        if (stat.isDirectory()) {
            results += generateTree(filePath, prefix + (isLast ? '    ' : '│   '));
        }
    });
    return results;
}

runAudit();