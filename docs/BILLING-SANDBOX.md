# E-Learn: integração de pagamentos em teste

## Estado em 5 de novembro de 2026

Implementação em branch de teste e [PR #1 em rascunho](https://github.com/jemmyprestes/generate-course-api/pull/1). A Vercel criou um preview com estado READY. **Pagamentos não ativados, não publicados em produção e ainda sem teste financeiro ponta a ponta.**

- Repositório conferido: `jemmyprestes/generate-course-api`, base `3f208c97f79a57ee2b6d8151ec6346efe1e48454`.
- GitHub conectado com permissão de escrita.
- Vercel conectada: projeto real `generate-course-api` (`prj_n0x6zn7mLjDosjrYuBxtxM1ydREj`), equipe `jemmy's projects`. `project-hfc6r.vercel.app` é um domínio desse projeto, não seu nome. Foi localizado na listagem geral após as consultas pelo nome antigo retornarem 404.
- Metadados confirmados: `STRIPE_SECRET_KEY` está restrita ao alvo production; não existe `STRIPE_WEBHOOK_SECRET`. As variáveis Supabase e OpenAI também abrangem preview; não se confirmou que apontam para recursos isolados de teste e não foram alteradas.
- Preview da implementação: `https://generate-course-pt69b8r67-jemmy-s-projects.vercel.app`, commit `f2479690e1fecc05c1faf06f05e0b30094bde4b3`, estado READY. As consultas autenticadas a suas rotas foram negadas com 403 na leitura da proteção de acesso. Necessário autorizar o projeto/equipe na conexão Vercel para executar verificações remotas.
- Supabase, Webflow e Stripe sem ferramentas autenticadas disponíveis nesta sessão.
- Não foram lidos valores de variáveis secretas.

## Produtos e regras

| Produto | Valor | Stripe price | Direito |
|---|---|---|---|
| Curso | €6,99 | price_1UQoxWEq0YRW8F2tWak663rl | Um novo trabalho de geração |
| Certificado | €3,99 | price_1UQp1qEq0YRW8F2tMILTky6u | Certificado do curso do próprio utilizador, após aprovação |
| Plus | €14,99 por mês | price_1UQp8BEq0YRW8F2tcILJ0Z55 | Cinco novos cursos por ciclo mensal efetivamente pago; certificados incluídos enquanto ativo |

Limites não acumulam. Retomar o mesmo trabalho não consome outro crédito. Cursos anteriores não são apagados ao terminar o Plus. O servidor verifica moeda, montante, periodicidade, quantidade e modo de teste; os IDs fornecidos ainda precisam ser conferidos na conta Stripe/sandbox correta. Não substituí preços nem criei produtos.

O saldo Plus só se renova com uma fatura paga e usa a data de fim da linha da fatura. Estados pendentes, inadimplentes ou cancelados não concedem acesso Plus. Um crédito avulso disponível é utilizado quando não há quota Plus disponível. Não há troca automática de plano, cobrança por excesso ou compra automática.

## Execução preparada

- `/api/create-checkout-session`: sessão Supabase validada pelo servidor; catálogo fechado; pedido persistido antes do Stripe; chave de idempotência vinculada ao pedido. `userId`, preços ou valores enviados pelo navegador não controlam a compra.
- `/api/stripe-webhook`: corpo original, assinatura HMAC SHA-256, tolerância de cinco minutos, verificação constante de assinatura, limite de 1 MB. Consulta o objeto atual no Stripe antes de conceder direitos.
- Direitos de compras e eventos são registrados na mesma transação PostgreSQL. Reenvios não geram créditos adicionais; a chave única do pedido impede duplicação mesmo com eventos diferentes.
- Novas tabelas com RLS e sem privilégios de navegador; funções de cobrança executáveis apenas pela service role. O endpoint de direitos sempre usa a identidade autenticada.
- `/api/start-generation` passa pelo wrapper transacional quando `BILLING_ENFORCED=true`; sem saldo, a criação do trabalho é revertida. O gatilho diferido impede inserir trabalhos diretamente para contornar o wrapper.
- O processador existente e seu mecanismo de retoma são preservados; a rota antiga `/api/generate` fica fechada durante a ativação do teste.
- Máximo de duas vezes o número de etapas previstas por trabalho em chamadas de IA; no máximo 26 para 12 módulos. Cada chamada iniciada consome uma tentativa, inclusive em falha. Três tentativas de geração de avaliação por curso.
- Avaliações de teste usam conteúdo persistido, vinculam gabarito ao curso e à conta, e conferem esse vínculo ao corrigir. A ativação retira escritas diretas do navegador em resultados e acesso aos gabaritos.
- `/api/certificate-access` verifica propriedade, pagamento/Plus e aprovação vinculada. É uma autorização de acesso; não emite um PDF nem substitui um emissor que esteja no Webflow.
- `webflow/billing-client.js` é um adaptador preparado para o cliente Supabase existente. Ainda não inserido no site por falta de acesso aos scripts e elementos reais.

O retorno `checkout=success` serve apenas para informar a interface. Não libera direitos. A interface deve consultar o estado autenticado e mostrar pagamento em confirmação até o webhook terminar.

## Comparação e margem inicial

Consulta em 05/11/2026:

- [Coursebox Creator](https://www.coursebox.ai/pricing): cerca de dez cursos/mês, créditos de IA e certificados incluídos. O preço monetário é dinâmico e não apareceu no conteúdo consultado; não foi presumido.
- [Mini Course Generator](https://minicoursegenerator.com/pricing/): Plus com 1.000 créditos IA/mês; Pro com 3.000 e certificados. Não equivale diretamente a um número de cursos E-Learn.
- [Documentação oficial OpenAI: GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna), modelo já usado pelo motor: US$0,20 por milhão de tokens de entrada e US$1,20 de saída para contexto curto. Não alterado nesta integração.
- [Stripe França](https://stripe.com/en-FR/pricing): referência pública de 1,5% + €0,25 para cartões EEE padrão; Billing de 0,7%. O contrato e país da conta podem diferir.

Decisão comercial inicial: cinco cursos por ciclo pago, com certificados incluídos. O utilizador delegou a escolha de um limite rentável e confirmou a inclusão do certificado.

Um curso de 12 módulos tem teto nominal de 151 mil tokens de saída (7 mil de plano + 12 × 12 mil), antes de tentativas adicionais e avaliações. A proteção de tentativas limita o número de chamadas, mas não é um teto contabilístico em euros. Custos reais dependem também da entrada, do raciocínio, dos reenvios e do câmbio.

Cenário de planeamento, **não lucro comprovado**: reservar €0,60 de IA por curso = €3 por assinante que usa todos os cinco cursos. Com as taxas Stripe de referência acima, sobram aproximadamente €11,41 dos €14,99 antes de IVA, hospedagem, suporte, reembolsos e aquisição de clientes. Se a reserva subir para €1/curso, sobram €9,41 antes desses custos. Medir o consumo real e a qualidade em sandbox antes de anunciar margens ou ativar produção.

## Verificação realizada

Testes locais usam PostgreSQL via PGlite com um esquema representativo dos contratos encontrados nas APIs. Cobrem assinaturas, alteração de bytes, expiração, isolamento entre contas, catálogo, idempotência, confirmação de pagamento, assinatura com fatura não paga, transações, saldo avulso, retoma, quota, certificados, privilégios e limite de tentativas.

Esses testes não comprovam compatibilidade com o esquema remoto nem a disponibilidade da conta Stripe. A verificação real ainda exige acesso.

## Trabalho pendente que depende de acesso

1. Autorizar acesso ao preview protegido do projeto/equipe na conexão Vercel. Disponibilizar uma chave Stripe comprovadamente sandbox no preview isolado; a chave existente está configurada apenas para production. Não foi copiada nem exposta.
2. Inspecionar o esquema real e as permissões no Supabase, em especial assinaturas das RPCs, `courses.content`, tipos UUID, resultados de avaliação e emissão de certificados. Criar branch de desenvolvimento e aplicar a migração nela; não no banco em produção.
3. Conferir os três preços na sandbox Stripe; criar o endpoint de eventos de teste e disponibilizar `STRIPE_WEBHOOK_SECRET` no ambiente de preview sem imprimir o valor. Ouvir checkout concluído/pago, alterações de assinatura e faturas pagas/falhadas. A versão do webhook deve ser compatível com `2026-10-28.endive`.
4. Conferir os scripts e botões reais no Webflow; integrar o adaptador e todos os emissores/downloads de certificados. O endpoint de autorização sozinho não protege um certificado inteiramente gerado no navegador.
5. Aplicar `supabase/activate-sandbox.sql` na branch de teste e ativar as duas flags apenas no preview ligado a esse banco. Simular compras dos três produtos, reenvios simultâneos, renovação/falha/cancelamento, mudança de conta, geração sem pagamento, retoma e aprovação/certificado.
6. Antes de produção: acrescentar política e tratamento de reembolsos/disputas, validade dos certificados após cancelamento, faturação fiscal e mecanismo de cancelamento da assinatura. A implementação atual não revoga automaticamente compras reembolsadas e não deve receber pagamentos reais.

Não há credenciais em arquivos. O código recusa ambiente Vercel de produção e chaves live. Produção requer uma alteração deliberada posterior, após revisão e testes completos.
