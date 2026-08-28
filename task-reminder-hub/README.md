# Task & Reminder Hub

App desktop (Windows) de tarefas, lembretes recorrentes e agenda visual, com
post-it flutuante sempre ativo e briefing de notícias em voz ao ligar o PC.

Roda 100% local: nenhum backend, nenhum dado sai da máquina.

## Stack

| Peça | Escolha |
|---|---|
| Shell | Electron + electron-vite |
| UI | React 19 + TypeScript |
| Banco | better-sqlite3 (arquivo em `%APPDATA%/task-reminder-hub/task-hub.db`) |
| Agendador | node-schedule (um tick de 30s varrendo lembretes vencidos) |
| Notícias | rss-parser + TTS nativo (`say` → SAPI no Windows) |
| Instalador | electron-builder (NSIS, um clique) |

## Rodando

```bash
npm install        # o postinstall recompila o better-sqlite3 para o ABI do Electron
npm run dev        # dashboard + post-it + captura, com HMR
npm test           # motor de recorrência, parser da captura e camada de banco
npm run typecheck  # main/preload/renderer
npm run dist       # gera dist/Task Reminder Hub-0.1.0-setup.exe
```

> Em Linux/macOS o app abre para desenvolvimento, mas dois recursos são
> específicos do Windows: os botões do toast (Concluir / Adiar / Abrir) e a
> voz do briefing. Fora do Windows a notificação vira um toast simples e o
> briefing fica só em texto.

## Três superfícies

| Janela | Arquivo | Papel |
|---|---|---|
| Post-it | `src/renderer/src/postit` | Sem moldura, always-on-top, pendências + captura embutida |
| Captura rápida | `src/renderer/src/capture` | Abre no atalho global, digita, Enter, some |
| Dashboard | `src/renderer/src/dashboard` | Tarefas, Agenda, Briefing, Produtividade e Ajustes |

Atalho global padrão: **Ctrl+Alt+Espaço** (configurável em Ajustes).

## Aparência

Violeta profundo sobre superfícies flutuantes: barra lateral em degradê,
cartões de canto largo, pílulas para agendas e filtros.

O tema é escolha explícita — **claro, escuro ou seguir o sistema** — pelo
alternador no rodapé da barra lateral, em Ajustes ou no botão do post-it. A
preferência fica no banco (`settings.theme`) e vale para as três janelas ao
mesmo tempo.

Os papéis de cor vivem em `src/renderer/src/shared/tokens.css`: `:root` traz o
modo claro e `:root[data-theme='escuro']` só redefine os tokens, então nenhum
componente precisa saber em que tema está. Ícones são SVG de traço em
`shared/Icon.tsx` (herdam `currentColor`), e as fontes vão empacotadas — o app
não busca nada na rede para desenhar a interface.

## Sintaxe da captura rápida

Uma linha cria tarefa, categoria, prioridade, data e recorrência:

```
Ligar pro contador #Loja !alta @amanha 09:00
Beber água *30m
Fechar caixa #Loja *diario 19:00
Treino *semanal seg,qua,sex 07:00
Aluguel *mensal 5 09:00
```

| Token | Efeito |
|---|---|
| `#nome` | Categoria (cria se não existir) |
| `!alta` `!media` `!baixa` | Prioridade |
| `@hoje 14:00` `@amanha` `@sex 08:00` `@25/12 08:00` `@14:00` | Quando |
| `*30m` `*2h` `*diario HH:MM` `*semanal seg,qua HH:MM` `*mensal 15 HH:MM` | Recorrência |

O que o parser não entende volta para o título, com aviso no preview — nunca
engole texto silenciosamente.

## Recorrência

`src/shared/recurrence.ts` é o motor, puro e testado. Tipos e como o
`recurrence_value` é guardado:

| Tipo | Valor | Exemplo |
|---|---|---|
| `once` | `null` | usa `next_trigger_at` |
| `minutes` / `hourly` | inteiro | `30`, `2` |
| `daily` | `HH:MM` | `08:00` |
| `weekly` | `dias@HH:MM` (0=dom) | `1,3,5@08:00` |
| `monthly` | `dia@HH:MM` | `15@08:00` (dia 31 cai no último dia válido do mês) |
| `custom_times` | lista `HH:MM` | `08:00,12:30,18:00` |

O `catchUp()` evita avalanche: se o PC ficou horas desligado, o lembrete
avança até o próximo horário futuro em vez de disparar tudo atrasado.

## Banco

Migrações versionadas em `src/main/db/schema.ts` (`schema_migrations` guarda o
que já rodou; nunca edite uma migração publicada — acrescente outra).

```
categories     id, name, color, visible, created_at
tasks          id, title, description, category_id, priority, status,
               due_at, duration_minutes, created_at, updated_at, completed_at
reminders      id, task_id (único), recurrence_type, recurrence_value,
               next_trigger_at, last_triggered_at, enabled
history        id, task_id, action, timestamp, meta
news_sources   id, category_id, name, feed_url, enabled
news_read_log  id, article_url, read_at
settings       key, value (JSON)
```

Diferenças em relação ao rascunho do briefing, todas deliberadas:
`due_at` + `duration_minutes` em `tasks` (o calendário precisa saber quando e
por quanto tempo), `enabled`/`last_triggered_at` em `reminders`, `meta` em
`history` (guarda de/para do reagendamento) e a tabela `settings`.

## Notificações com ações no Windows

Botões em toast do Windows só existem via XML nativo. O app monta o
`toastXml` com `activationType="protocol"`, então cada botão abre
`framehub://task/<id>/(complete|snooze|open)`; a instância única recebe a URL
e executa a ação (`handleProtocolUrl` em `src/main/index.ts`).

Isso depende de `AppUserModelId` + atalho no menu iniciar — o instalador NSIS
cria os dois. Rodando via `npm run dev` os botões podem não aparecer; a
notificação simples e o clique continuam funcionando.

## Briefing de notícias

1. Dois segundos após o boot, busca em paralelo os feeds ativos (falha de um
   feed não derruba os outros).
2. Descarta o que já está em `news_read_log`.
3. Lê título + resumo em sequência, com play/pausa/pular/velocidade.
4. Marca cada notícia como lida ao terminar de falar.

Fontes ficam em Briefing → Fontes: qualquer RSS, inclusive
`news.google.com/rss/search?q=...` para temas sem feed dedicado.

Trocar a voz nativa por um serviço em nuvem é implementar `TtsEngine`
(`src/main/news/tts.ts`) — a lógica de busca não muda.

## Estrutura

```
src/
  main/           processo principal: banco, agendador, tray, hotkey, IPC, notícias
  preload/        ponte contextIsolation → window.api
  renderer/       as três superfícies React
  shared/         tipos, contrato de IPC, recorrência, parser (main + renderer)
tests/            node:test sobre recorrência, parser e banco
```
