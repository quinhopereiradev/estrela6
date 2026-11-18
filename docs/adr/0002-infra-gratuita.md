# 0002 · Infraestrutura gratuita

- **Status:** aceita
- **Data:** 2026-11-17

## Contexto
O orçamento é zero, exceto o domínio. O site precisa aparecer bem no Google (rápido, HTTPS, estável).

## Decisão
VM ARM do Oracle Cloud Always Free (app, MySQL, fila, cron) + Cloudflare (DNS, proxy, cache, HTTPS) + Cloudflare R2 (arquivos, sem custo de tráfego) + GitHub (código, Actions). Domínio .com.br (cerca de R$ 40/ano) ou .com.

## Alternativas
- Laravel Cloud: crédito inicial pequeno, depois pago.
- Hospedagem compartilhada: barata, mas sem fila/cron adequados e lenta.

## Consequências
Somos responsáveis pelo servidor (atualizações, backup, monitoramento). Risco: a Oracle pode recuperar instâncias ociosas e mudar a cota; mitigação com backup diário no R2 e deploy reproduzível (qualquer VPS serve).
