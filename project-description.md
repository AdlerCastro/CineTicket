# CineTicket — Plataforma de Ingressos de Cinema

## O que é

Sistema de venda de ingressos de cinema com três papéis distintos:
- **Organizador** (gerente de cinema): cria sessões a partir de um catálogo de filmes (TMDb), define sala, horário, mapa de assentos e preço.
- **Cliente**: navega pelas sessões publicadas, reserva um assento num mapa em tempo real, paga de forma simulada, recebe um ingresso com QR assinado e pode compartilhá-lo por link.
- **Portaria**: valida o ingresso na entrada (leitura de QR via câmera ou digitação manual), com retorno claro de válido / inválido / já utilizado / evento errado.

Este é um projeto de avaliação técnica (teste seletivo), desenvolvido em 7 dias com uso assistido de IA, seguindo metodologia de Arquiteto + agentes especializados documentada em `agent-ecosystem.md`.

## Para quem

- Avaliador do processo seletivo, testando funcionalidade, qualidade de código, interface, segurança, modelagem, uso de IA, documentação e engenharia.
- Não é um produto com usuários reais — decisões de escopo e prioridade foram tomadas em função do critério de avaliação, não de crescimento futuro.

## Problema que resolve

Simula o fluxo completo de venda de ingresso de cinema — do catálogo de filme até a validação na portaria — com a restrição central de que **o mesmo assento nunca pode ser vendido duas vezes** e **o mesmo ingresso nunca pode ser validado duas vezes**, mesmo sob concorrência real (múltiplos clientes tentando reservar o mesmo assento simultaneamente).

## Por que este escopo

Decisões de escopo documentadas em `.context/decisions-log.md`. Resumo das mais relevantes:
- TMDb em vez de Ticketmaster: menos dados prontos (só metadado de filme), mas permite modelar sessão/sala/assento com mais controle e liberdade de design de dados — trade-off consciente entre "menos integração pronta" e "mais superfície para demonstrar modelagem".
- Assento único (sem tipos PCD/casal): funcionalidade de tipo de assento sem regra de negócio associada não estava no enunciado e foi cortada deliberadamente para não competir por tempo com o core (mapa de assento, concorrência, WebSocket).
- Sem internacionalização: custo de implementação não compensava o peso do critério.
- WebSocket em vez de polling: escolha consciente de maior risco técnico em troca de aprendizado e de atender melhor "tempo real" como critério pontuado — com marco de decisão no dia 5 para fallback em polling se instável.

## Estado atual

_Atualizar conforme o projeto avança. Preencher com: fase atual (setup / sprint N / deploy), o que está funcional, o que está pendente, riscos abertos._

- [ ] Setup do monorepo e ambientes (Docker Compose dev/test)
- [ ] Backend: auth + papéis
- [ ] Backend: integração TMDb
- [ ] Backend: criação de sessão e mapa de assentos
- [ ] Backend: reserva com constraint de concorrência + expiração de 5min
- [ ] Backend: pagamento simulado
- [ ] Backend: geração de ingresso (JWT + QR)
- [ ] Backend: validação de portaria
- [ ] Backend: WebSocket do mapa de assentos
- [ ] Frontend: navegação e busca de sessões
- [ ] Frontend: painel do organizador
- [ ] Frontend: fluxo de reserva + mapa de assentos
- [ ] Frontend: pagamento simulado
- [ ] Frontend: "Meus ingressos"
- [ ] Frontend: tela de portaria (câmera + manual)
- [ ] Tema customizado + dark mode
- [ ] Testes de concorrência de assento
- [ ] Testes de ingresso duplicado
- [ ] CI (lint + test + build)
- [ ] Deploy backend (Railway) + frontend (Vercel)
- [ ] README com instruções de setup e configuração de API externa
- [ ] Dados semeados (1 organizador, 2 clientes, 1 portaria, 1 sessão com ingressos disponíveis)
