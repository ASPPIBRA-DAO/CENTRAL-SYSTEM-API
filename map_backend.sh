#!/bin/bash

REPORT_FILE="ESTRUTURA_BACKEND_REPORT.txt"

echo "🚀 Iniciando mapeamento do Governance System Backend..." > $REPORT_FILE
echo "Data: $(date)" >> $REPORT_FILE
echo "------------------------------------------------" >> $REPORT_FILE

# 1. Mapeando a Árvore de Diretórios (ignorando node_modules e dist)
echo -e "\n📂 1. ÁRVORE DE DIRETÓRIOS:" >> $REPORT_FILE
if command -v tree > /dev/null; then
    tree -I 'node_modules|dist|.wrangler|.git' >> $REPORT_FILE
else
    find . -maxdepth 4 -not -path '*/.*' -not -path './node_modules*' -not -path './dist*' >> $REPORT_FILE
fi

echo -e "\n------------------------------------------------" >> $REPORT_FILE

# 2. Mapeando o Schema do Banco de Dados (Drizzle)
echo -e "\n🗄️ 2. SCHEMA DO BANCO DE DADOS (src/db/schema.ts):" >> $REPORT_FILE
if [ -f "src/db/schema.ts" ]; then
    cat src/db/schema.ts >> $REPORT_FILE
else
    echo "Arquivo src/db/schema.ts não encontrado." >> $REPORT_FILE
fi

echo -e "\n------------------------------------------------" >> $REPORT_FILE

# 3. Mapeando as Rotas (Index principal e pastas de rotas)
echo -e "\n🌐 3. DEFINIÇÃO DE ROTAS (src/index.ts ou src/routes/):" >> $REPORT_FILE
if [ -f "src/index.ts" ]; then
    cat src/index.ts >> $REPORT_FILE
fi

# Lista arquivos na pasta routes para entender os endpoints
find src/routes -name "*.ts" -exec echo -e "\n--- Arquivo: {} ---" \; -exec cat {} \; >> $REPORT_FILE

echo -e "\n------------------------------------------------" >> $REPORT_FILE

# 4. Mapeando o Wrangler.toml (Configuração Cloudflare)
echo -e "\n☁️ 4. CONFIGURAÇÃO CLOUDFLARE (wrangler.toml):" >> $REPORT_FILE
if [ -f "wrangler.toml" ]; then
    cat wrangler.toml | grep -v "PASSWORD\|SECRET\|KEY" >> $REPORT_FILE # Remove segredos por segurança
else
    echo "wrangler.toml não encontrado." >> $REPORT_FILE
fi

echo -e "\n\n✅ Mapeamento concluído! Envie o conteúdo do arquivo $REPORT_FILE para o Gemini."
