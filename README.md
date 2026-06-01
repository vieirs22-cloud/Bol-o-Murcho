Bolão Murcho
Aplicação web para gerenciar um bolão da Copa do Mundo 2026.

O projeto permite que participantes façam palpites por fase, acompanhem a classificação e consultem o regulamento. O administrador gerencia participantes, prazos, liberação de fases e resultados oficiais.

Produção: bolaomurcho.pages.dev

Principais Funcionalidades
Login com perfis de admin e participant.
Cadastro e gestão de participantes pelo Admin.
Palpites gerais: campeão, vice, artilheiro e melhor jogador.
Palpites da fase de grupos com 72 jogos.
Palpites de mata-mata liberados por fase.
Comportas de fase por prazo e por resultado oficial.
Ranking/Classificação com atualização automática.
Regulamento do bolão.
Fallback administrativo para lançar resultados oficiais.
Regras de Fase
Cada fase pode estar em um destes estados:

nao_liberada
aberta_para_palpites
em_andamento
finalizada
resultados_publicados
A fase aceita palpites somente quando está aberta_para_palpites.

A edição bloqueia automaticamente quando:

o prazo configurado no Admin vence;
qualquer resultado oficial da fase começa a ser computado.
Palpites Gerais e Palpites da fase de grupos compartilham o mesmo prazo.

Stack
Next.js
React
TypeScript
Supabase
Cloudflare Pages
Rodando Localmente
Instale as dependências:

npm install
Crie um arquivo .env.local com as variáveis públicas do Supabase:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
Inicie o servidor de desenvolvimento:

npm run dev
Acesse:

http://localhost:3000
Scripts
npm run dev
Roda o ambiente local.

npm run build
Gera a versão estática do app em out/.

npm run lint
Executa validação de lint.

npm run db:apply
Aplica os arquivos SQL em database/ no Supabase usando DATABASE_URL.

Banco de Dados
Os arquivos SQL ficam em:

database/
Arquivos principais:

supabase_schema.sql: estrutura das tabelas, tipos e funções-base.
supabase_app_api.sql: RPCs usados pelo frontend.
supabase_seed.sql: dados iniciais, times, jogos e controles de fase.
Para aplicar no Supabase:

DATABASE_URL="postgresql://..." npm run db:apply
Nunca commite senhas, URLs privadas de banco ou tokens sensíveis.

Deploy
O app é exportado como site estático pelo Next.js:

npm run build
Deploy no Cloudflare Pages:

npx wrangler pages deploy out --project-name bolaomurcho --branch main --commit-dirty=true
Estrutura Principal
src/app/page.tsx
Concentra as telas principais do MVP.

src/app/globals.css
Estilos globais da interface.

src/lib/bolao.ts
Tipos, seeds locais e utilitários do bolão.

src/lib/supabase-data.ts
Comunicação com Supabase.

src/utils/phaseStatus.ts
Regras centralizadas das comportas de fase.

Fluxo do Produto
Admin cadastra participantes.
Participante entra com e-mail e senha.
No primeiro acesso, o usuário recebe um aviso de boas-vindas.
Participante preenche Palpites Gerais.
Participante preenche os jogos da fase de grupos.
O Admin configura prazos e resultados oficiais.
Quando a fase trava, palpites ficam somente para consulta.
A Classificação é atualizada com os dados salvos no Supabase.
Observações
Este projeto é um MVP funcional. Algumas partes foram estruturadas para evolução futura, como integração automática com fonte de resultados, cálculo avançado de critérios de desempate e fechamento completo do bolão após a final.
