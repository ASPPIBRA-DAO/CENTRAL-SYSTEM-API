📘 DOCUMENTAÇÃO ARQUITETURAL – CENTRAL-SYSTEM-API

The Sovereign Nexus Architecture – ASPPIBRA DAO
Versão: 1.0
Última atualização: 12/12/2025

1. Visão Geral

O CENTRAL-SYSTEM-API atua como a autoridade central ("Mothership") da arquitetura Hub-and-Spoke da ASPPIBRA DAO.
Ele funciona como:

API Gateway

Núcleo de Identidade e Governança

Orquestrador de Microsserviços Web2 / Web3

Camada de Segurança e Compliance

Ponto Único de Observabilidade e Monitoramento

A solução está implementada sobre Cloudflare Workers, adotando:

Hono.js como framework HTTP

Cloudflare D1 como banco relacional

Cloudflare R2 para storage

Drizzle ORM

Zod para validação

JWT para identidade

IPFS/Pinata para armazenamento descentralizado

RWA/Agro Modules para lógica blockchain

2. Estrutura de Diretórios (Formalizada)
central-system-api/
├── .dev.vars                 # Secrets locais (não versionados)
├── .gitignore
├── package.json              # Dependências e scripts
├── pnpm-lock.yaml
├── wrangler.jsonc            # Configuração da infraestrutura Cloudflare
├── drizzle.config.ts         # Configuração do Drizzle ORM
├── migrations/               # Migrações do banco D1
├── public/                   # Arquivos estáticos (dashboard, assets)
├── test/                     # Testes unitários e de integração
│   ├── auth.spec.ts
│   └── users.spec.ts
└── src/
    ├── db/
    │   ├── index.ts          # Instância do banco (Drizzle + D1)
    │   └── schema.ts         # Definição das tabelas
    │
    ├── types/
    │   └── bindings.d.ts     # Tipagem de c.env (bindings e secrets)
    │
    ├── utils/
    │   ├── response.ts       # Formatação de respostas
    │   └── auth-guard.ts     # Validação de autenticação
    │
    ├── validators/
    │   └── users.ts          # Validação via Zod
    │
    ├── views/
    │   └── dashboard.ts      # Dashboard administrativo
    │
    ├── middlewares/
    │   ├── auth-jwt.ts       # Autenticação de rotas
    │   └── rate-limit.ts     # Limitação de requisições
    │
    ├── routes/
    │   └── api-modules/
    │       ├── auth.ts       # Identidade
    │       ├── users.ts      # Gerenciamento de usuários
    │       ├── payments.ts   # Web2 – Pagamentos
    │       ├── webhooks.ts   # Web2 – Webhooks financeiros
    │       ├── rwa.ts        # Web3 – Lógica de Real World Assets
    │       ├── agro.ts       # Web3 – Lógica AgroDAO
    │       ├── ipfs.ts       # Armazenamento descentralizado (IPFS)
    │       └── health.ts     # Monitoramento
    │
    └── index.ts              # Ponto de entrada do Worker

3. Objetivos Arquiteturais
3.1 Principais Metas

Centralizar segurança, autenticação e governança.

Prover um único ponto de integração entre Web2, Web3 e infraestrutura DAO.

Oferecer modularidade e escalabilidade via API Gateway.

Reduzir acoplamento entre serviços.

Garantir rastreabilidade para transparência DAO.

3.2 Drivers Arquiteturais

Operação distribuída em escala

Confiabilidade e auditabilidade

Baixo custo (Workers)

Alta performance global

Conformidade organizacional (DAO)

4. Componentes Principais
4.1 API Gateway

Entrada única para todas as aplicações Web, Mobile, IoT e DApps.

Gerencia rotas, versionamento e throttling.

4.2 Módulo de Identidade (IdM)

Emite e valida tokens JWT.

Integra com biometria, wallets Web3 ou credenciais Web2.

Suporte planejado para DID.

4.3 Orquestrador de Serviços

Router baseado em Hono.

Módulos independentes para auth, usuários, pagamentos, etc.

Permite evolução incremental.

4.4 Persistência

D1 + Drizzle ORM

Migrações versionadas

Operações atomicamente consistentes

4.5 Armazenamento Descentralizado

IPFS via Pinata Proxy

Assinatura de arquivos

Verificação de CID

4.6 RWA & Agro Services (Blockchain Layer)

Tokenização de ativos reais

Registro de produção agroecológica

Auditoria e rastreabilidade

5. Diagrama C4 – Nível 1 (Contexto)
                          +----------------------+
                          |     Usuários         |
                          |  Web / Mobile / IoT  |
                          +----------+-----------+
                                     |
                                     | HTTPS Requests
                                     |
                        +------------v--------------+
                        |   CENTRAL-SYSTEM-API      |
                        |      (API Gateway)        |
                        +----+------------+---------+
                             |            |
                             |            |
          +------------------v--+     +---v--------------------+
          | Serviços Internos   |     |    Sistemas Externos   |
          | (Auth, Users, etc.) |     | (Pagamentos, IPFS etc.)|
          +---------------------+     +-------------------------+

6. Diagrama C4 – Nível 2 (Containers)
+---------------------------------------------------------------+
|                  CENTRAL-SYSTEM-API (Worker)                  |
|---------------------------------------------------------------|
|  Hono Router                                                   |
|  Middlewares: Auth, Rate-Limit                                |
|  Modules: Auth, Users, Payments, RWA, Agro, IPFS, Health      |
|                                                               |
|      +------------------+       +-------------------------+   |
|      |  D1 Database     |<----->|   Drizzle ORM           |   |
|      +------------------+       +-------------------------+   |
|                                                               |
|      +------------------+       +-------------------------+   |
|      |   R2 Storage     |       | IPFS/Pinata Proxy       |   |
|      +------------------+       +-------------------------+   |
|                                                               |
|      +-----------------------------------------------+        |
|      | External Services: Pagamentos / Webhooks      |        |
|      +-----------------------------------------------+        |
+---------------------------------------------------------------+

7. Diagrama de Fluxo – Autenticação JWT
[Cliente]
    |
    | POST /auth/login
    v
[Validação Zod] --- parâmetros inválidos ---> erro 400
    |
    v
[Consulta ao D1 via Drizzle]
    |
    | credenciais válidas?
    |---- não ----> erro 401
    |
    v
[Geração de JWT]
    |
    v
[Resposta: token + payload]

8. Diagrama de Fluxo – Rota Protegida
[Cliente] --> GET /users/me --> [Middleware auth-jwt] --> token válido? 
                                                       |     |
                                                      não   sim
                                                       |     v
                                                  401 erro   [Controller]

9. API Gateway Routing (Visão Modular)
/api
 ├── /auth
 ├── /users
 ├── /payments
 ├── /webhooks
 ├── /rwa
 ├── /agro
 ├── /ipfs
 └── /health

10. Recomendações de Evolução
Curto prazo

Adicionar testes e2e com Miniflare.

Criar logs estruturados.

Médio prazo

Implementar refresh tokens.

Criar auditoria on-chain opcional para módulos sensíveis.

Longo prazo

Introduzir DID/VC (Identidade Descentralizada).

Migrar alguns módulos para Services separados (Workers AI, R2 Hooks etc.).