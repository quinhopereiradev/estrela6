---
name: revisao-seguranca
description: Checklist de segurança para revisar um PR do Estrela6 antes de abrir ou mergear. Use quando a mudança tocar autenticação, uploads, formulários públicos, o painel admin, endpoints internos, integrações externas, IA ou dependências.
---

# Revisão de segurança

Rode no diff do branch: `git diff main...HEAD`. Reporte cada achado com arquivo:linha, risco e correção. Não considere pronto com achado alto aberto.

## Autorização
- [ ] Toda rota/ação de escrita tem Policy (`Gate::authorize` / `->authorize()` no Filament) e teste de acesso negado.
- [ ] Livewire: propriedades públicas com IDs têm `#[Locked]`; ações validam dono/papel no servidor.
- [ ] Endpoints `/internal/*` exigem token (comparação com `hash_equals`) e ficam fora do sitemap.

## Entrada e saída
- [ ] Validação via Form Request / `validate()`; nada de `$request->all()` em `create()`/`update()`.
- [ ] Blade usa `{{ }}`; `{!! !!}` só com HTML sanitizado (Markdown dos posts passa por sanitizer com allowlist).
- [ ] Nada de SQL com interpolação; `whereRaw` só com bindings.
- [ ] URLs externas: só `http(s)`, `rel="noopener noreferrer nofollow"`.

## Uploads
- [ ] MIME real verificado, tamanho máximo, imagem reprocessada no servidor, EXIF/GPS removido, nome aleatório, bucket sem listagem.
- [ ] SVG de usuário não é aceito.

## Sessão e conta
- [ ] Login social (Discord/Google) com `state`; apelido único; confirmação de 16+ registrada.
- [ ] MFA obrigatório para `admin`/`moderador`.
- [ ] Rate limit em login, sugerir pin, confirmar, enviar artigo e busca.
- [ ] Exclusão de conta apaga dados pessoais (LGPD) e anonimiza contribuições.

## Cabeçalhos e infraestrutura
- [ ] CSP (spatie/laravel-csp) sem `unsafe-eval`; HSTS; `X-Content-Type-Options`; `Referrer-Policy`; cookies `Secure`, `HttpOnly`, `SameSite=Lax`.
- [ ] `APP_DEBUG=false` em produção; páginas de erro sem stack trace.

## Segredos e dependências
- [ ] Nenhum segredo no diff (gitleaks passa); `env()` só dentro de `config/`.
- [ ] `composer audit` e `npm audit --omit=dev` sem vulnerabilidade alta.
- [ ] Dependência nova: mantida, licença compatível, justificada no PR.

## IA e conteúdo externo
- [ ] Texto de feeds e da IA é dado não confiável: escapado, nunca executado como instrução, saída da IA validada por schema.
- [ ] Prompt não inclui dados pessoais de usuários.
- [ ] Conteúdo coletado nunca é publicado sem passar pela pauta (exceto fontes oficiais marcadas).
