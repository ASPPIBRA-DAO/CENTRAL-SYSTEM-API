#!/bin/bash
echo "======= SNAPSHOT DE DIAGNÓSTICO ASPPIBRA-DAO ======"
echo "Gerado em: $(date)"
echo ""

echo "--- 📂 1. CONFIGURAÇÃO DE AMBIENTE (FRONTEND) ---"
cat ~/Gov-System/.env | grep VITE_API_URL
echo ""

echo "--- 📂 2. MAPEAMENTO DE ENDPOINTS (FRONTEND) ---"
cat ~/Gov-System/src/lib/axios.ts | grep -A 15 "auth: {"
echo ""

echo "--- 📂 3. CHAMADA DE LOGIN (FRONTEND) ---"
grep -r "axios.post" ~/Gov-System/src/auth/context/jwt/ | head -n 5
echo ""

echo "--- 📂 4. ROTEAMENTO CENTRAL (BACKEND) ---"
cat ~/CENTRAL-SYSTEM-API/src/index.ts | grep -E "app.use|app.route|app.get|app.post"
echo ""

echo "--- 📂 5. DEFINIÇÃO DAS ROTAS DE AUTH (BACKEND) ---"
cat ~/CENTRAL-SYSTEM-API/src/routes/core/auth/index.ts | grep -E "auth.(post|get)"
echo ""

echo "--- 📂 6. POLÍTICA DE CORS (BACKEND) ---"
grep -A 15 "cors({" ~/CENTRAL-SYSTEM-API/src/index.ts
echo ""

echo "======= FIM DO RELATÓRIO ======"
