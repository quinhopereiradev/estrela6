# Guia de infraestrutura: o que o Quinho faz (uma vez)

Ordem pensada para não travar: cada etapa entrega algo que a próxima usa. Tempo total estimado: uma tarde, mais a espera da propagação do DNS.
Custo: **só o domínio** (cerca de R$ 40/ano no registro.br). Oracle e Cloudflare R2 pedem cartão apenas para verificação; dentro das cotas grátis não há cobrança.

Guarde tudo num gerenciador de senhas (Bitwarden grátis serve). Ative 2FA em **todas** as contas.

---

## 1. Domínio (registro.br) · 15 min
1. Pesquise `estrela6.com.br` em registro.br. Se estiver livre, registre com seu CPF (renovação automática ligada).
2. Ative a verificação em duas etapas na conta do registro.br.
3. Opcional: pesquise "Estrela6" na busca de marcas do INPI (consulta gratuita). Registrar a marca é pago e pode ficar para depois do lançamento.
4. Não mexa no DNS ainda; isso vem na etapa 2.

## 2. Cloudflare (DNS, HTTPS, cache, e-mail) · 20 min + propagação
1. Crie a conta em cloudflare.com, ative 2FA.
2. **Add a domain** → `estrela6.com.br` → plano **Free**.
3. A Cloudflare mostra **dois nameservers**. No registro.br: domínio → **Alterar servidores DNS** → cole os dois. A propagação de .br costuma levar algumas horas.
4. Enquanto o domínio está **Pending** dá para seguir com as etapas 3 (menos o domínio `cdn.`), 4, 5, 6 e 7. Quando ficar **Active** (status na página inicial da conta + e-mail da Cloudflare):
   - SSL/TLS → **Origin Server** → *Create Certificate* (RSA, 15 anos, `estrela6.com.br` e `*.estrela6.com.br`). Salve o certificado e a chave privada: vão para o servidor na etapa 4.
   - Security → **Bot Fight Mode** ligado.
   - O modo **Full (strict)** e o **Always Use HTTPS** só depois que o servidor estiver rodando com o certificado (fim da etapa 4). Se aparecer "Automatic SSL/TLS", escolha **Custom** → **Full (strict)**.
   - **Email Routing**: crie `contato@estrela6.com.br` encaminhando para seu e-mail pessoal (grátis).
5. Os registros DNS (`@`, `www`, `staging`, `cdn`) você cria nas etapas 3 e 4.

## 3. Cloudflare R2 (arquivos: tiles, imagens, músicas, boletins) · 15 min
1. No painel da Cloudflare → **R2**. Na primeira vez ela pede um meio de pagamento (verificação; a cota grátis continua valendo).
2. **Create bucket** `estrela6` (localização automática).
3. Bucket → Settings → **Custom Domains** → `cdn.estrela6.com.br` (a Cloudflare cria o DNS sozinha). **Só funciona com o domínio Active**; antes disso aparece "the specified zone is not valid". Pule e volte depois.
4. Bucket → Settings → **CORS**: permitir `GET`, `HEAD` de `https://estrela6.com.br` e `https://staging.estrela6.com.br`.
5. R2 → **Manage API Tokens** → *Create Account API token* → permissão **Object Read & Write**, só no bucket `estrela6`. Guarde: *Access Key ID*, *Secret Access Key* e o *endpoint* `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
6. Conta → Billing → **Notifications**: alerta de uso para não passar da cota.

## 4. Servidor (Oracle Cloud Always Free) · 45 min
**Limites atuais:** a cota grátis de Ampere A1 caiu para **2 OCPU e 12 GB de RAM no total**. Não passe disso: uso acima do limite pode ser cobrado, e no fim do trial instâncias acima do limite são desativadas.

1. Crie a conta em oracle.com/cloud/free. A **região inicial (home region)** não muda depois: escolha **Brazil East (São Paulo)** ou **Brazil Southeast (Vinhedo)**.
2. Governance → **Budgets**: orçamento de US$ 1 com alerta por e-mail (só aviso).
3. Compute → Instances → **Create instance**:
   - Imagem **Canonical Ubuntu 24.04** (aarch64); shape **VM.Standard.A1.Flex** com **2 OCPU e 12 GB**;
   - rede: deixe o assistente criar a VCN e a subnet pública, com IP público;
   - SSH: gere um par de chaves no seu PC (`ssh-keygen -t ed25519 -C estrela6`) e cole a **pública**;
   - boot volume: 100 GB (o limite grátis total é 200 GB).
   - Se aparecer "Out of capacity", tente outro *availability domain* ou tente de novo mais tarde.
4. Networking → VCN → Security List → **Ingress rules**: TCP 80 e 443 de `0.0.0.0/0` (depois o script restringe aos IPs da Cloudflare).
5. Anote o IP público. Na Cloudflare → DNS, crie (todos **Proxied**, nuvem laranja):
   - `A @ → IP` · `A staging → IP` · `CNAME www → estrela6.com.br`
6. No seu PC, copie o script e o certificado de origem e rode a preparação:
   ```bash
   scp tools/server/provision.sh tools/server/Caddyfile origin.pem origin.key ubuntu@IP:/tmp/
   ssh ubuntu@IP 'sudo bash /tmp/provision.sh'
   ```
   Depois que o site responder, volte na Cloudflare: SSL/TLS → **Custom** → **Full (strict)** e Edge Certificates → **Always Use HTTPS**.
   O script instala PHP 8.4, MySQL 8, Caddy, Supervisor, fail2ban, atualizações automáticas, cria o usuário `deploy`, as pastas de staging e produção e os bancos, libera 80/443 só para a Cloudflare e imprime o que falta (senhas geradas e a chave pública do deploy).
7. Guarde as senhas do MySQL que o script imprime. Crie os `.env` em `/var/www/estrela6/{production,staging}/shared/.env` a partir do `.env.example` do projeto (o Claude Code pode gerar o conteúdo; os segredos você cola).

## 5. GitHub · 30 min
1. Conta com **2FA** (Settings → Password and authentication). Crie o repositório **público** `estrela6`, sem README, sem .gitignore e sem licença (o Laravel e o kit trazem os arquivos). Sem licença = código visível, mas todos os direitos reservados.
2. Settings → General → **Pull Requests**: deixe só **Allow squash merging** e marque **Automatically delete head branches**.
3. Settings → **Environments**: `staging` (sem regras) e `production` (**Required reviewers**: você; marque *Prevent self-review* desligado). Em cada um, a variável `APP_URL`.
4. **Secrets do repositório** (Settings → Secrets and variables → Actions → *Repository secrets*):
   | Nome | Valor | Quando |
   |---|---|---|
   | `RADIO_PIPELINE_TOKEN` | `openssl rand -hex 32` (o mesmo valor vai no `.env` de produção) | agora |
   | `RELEASE_PLEASE_TOKEN` | token *fine-grained*, só o repo `estrela6`, Contents + Pull requests: Read and write | agora |
   | `ANTHROPIC_API_KEY` | etapa 6 | agora |
   | `R2_ENDPOINT` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` | etapa 3 | agora |
   | `DEPLOY_HOST` · `DEPLOY_USER` | IP da VM · `deploy` | após a VM |
   | `DEPLOY_SSH_KEY` | `sudo cat /home/deploy/.ssh/id_deploy` no servidor | após o provision.sh |
   | `DEPLOY_KNOWN_HOSTS` | saída de `ssh-keyscan IP` | após a VM |

   **Secret do environment `staging`:** `STAGING_BASIC_AUTH` = `equipe:senha` impressa pelo `provision.sh`.
   **Variáveis do repositório:** `PRODUCTION_URL=https://estrela6.com.br`, `R2_BUCKET=estrela6`, `R2_PUBLIC_URL=https://cdn.estrela6.com.br`.
5. Settings → **Advanced Security** (ou Code security): **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** + **Push protection** e **Private vulnerability reporting** ligados.
6. **Ruleset da `main`** — depois que a CI rodar pela primeira vez (os checks só aparecem para seleção depois disso; o Claude Code avisa no M0). Settings → Rules → Rulesets → *New branch ruleset*:
   - Nome `main`, Enforcement **Active**, Target **Include default branch**, Bypass list **vazia**.
   - Marque: **Restrict deletions**, **Block force pushes**, **Require linear history**, **Require a pull request before merging** (aprovações **0**, porque você trabalha sozinho; *Allowed merge methods*: **Squash**), **Require status checks to pass** (adicione `Pint · PHPStan · Rector`, `Testes (Pest)`, `Front-end (build e lint)`, `Dependências vulneráveis`, `Segredos no código (gitleaks)`, `Análise de código (Semgrep)`; marque *Require branches to be up to date*).

## 6. Chave da IA (Anthropic) · 5 min
1. console.anthropic.com → crie a organização, adicione crédito mínimo e defina um **limite de gasto mensal** baixo (ex.: US$ 5).
2. Crie uma API key só para o projeto → secret `ANTHROPIC_API_KEY` e `.env` de produção.

## 7. Login social · 15 min
- **Discord**: discord.com/developers → New Application → OAuth2 → Redirects: `https://estrela6.com.br/auth/discord/callback` e `https://staging.estrela6.com.br/auth/discord/callback`. Copie Client ID e Secret para os `.env`.
- **Google**: console.cloud.google.com → novo projeto → tela de consentimento (externo, nome "Estrela6") → Credenciais → ID do cliente OAuth (Web) com os mesmos dois callbacks trocando `discord` por `google`.

## 8. Busca e monitoramento · 15 min (quando a página "em breve" estiver no ar)
1. **Google Search Console**: propriedade de domínio `estrela6.com.br`, verificação por TXT (crie o TXT na Cloudflare).
2. **Bing Webmaster Tools**: importe do Search Console.
3. Um **monitor de disponibilidade** gratuito apontando para `https://estrela6.com.br/up`, com alerta no seu e-mail.

## 9. Entregar ao Claude Code
Com o repositório criado e o kit na raiz, abra o Claude Code e peça:
> Leia o CLAUDE.md, o docs/08-roadmap.md e o docs/09-guia-de-infra.md. Execute o marco M0 item por item, um PR por item. O servidor já foi preparado com tools/server/provision.sh.

### Checklist rápido
- [ ] Domínio registrado, 2FA no registro.br
- [ ] Cloudflare ativo, SSL Full (strict), certificado de origem salvo, e-mail de contato
- [ ] Bucket R2 + `cdn.` + token de API
- [ ] VM A1 2 OCPU/12 GB, orçamento com alerta, DNS `@`/`www`/`staging`
- [ ] `provision.sh` rodado, senhas guardadas, `.env` criados
- [ ] Repositório, ruleset, environments, secrets e variables
- [ ] Chave da Anthropic com limite de gasto
- [ ] Apps OAuth do Discord e do Google
- [ ] Search Console, Bing, monitor de disponibilidade

## Pendências que dependem da VM (Oracle sem capacidade)
A VM está sendo criada pelo script `hitrov/oci-arm-host-capacity` (loop a cada 2 min no PC; .env com OCI_OCPUS=2, OCI_MEMORY_IN_GBS=12, subnet pública da `vcn-estrela6` mais antiga). Upgrade para Pay As You Go pedido em paralelo. Quando a VM for criada:
- [ ] Parar o loop (Ctrl + C).
- [ ] Instância → Attached VNICs → IPv4 Addresses → Edit → **Ephemeral public IP**.
- [ ] Portas 80/443 na Security List **da mesma VCN** da subnet usada; conferir Internet Gateway e rota `0.0.0.0/0`.
- [ ] `ssh ubuntu@IP` funcionando.
- [ ] Cloudflare DNS: `A @`, `A staging`, `CNAME www` (Proxied).
- [ ] Apagar a chave de API da Oracle (perfil → API keys) e o `.pem` do computador.
- [ ] Opcional: apagar as duas `vcn-estrela6` sobrando.

## Pendências que dependem do domínio Active
Anotadas enquanto o `.br` propagava. Faça nesta ordem quando a Cloudflare mostrar **Active**:
- [ ] R2: domínio próprio `cdn.estrela6.com.br` (antes disso dá "the specified zone is not valid").
- [ ] Certificado de origem (SSL/TLS → Origin Server), salvar `origin.pem` e `origin.key`.
- [ ] Email Routing: apagar o MX "." do registro.br e criar `contato@estrela6.com.br`.
- [ ] Bot Fight Mode ligado.
- [ ] Rodar `provision.sh` na VM (precisa do certificado) e conferir `sudo caddy validate --config /etc/caddy/Caddyfile`.
- [ ] Com o site respondendo: SSL/TLS → Custom → **Full (strict)** e **Always Use HTTPS**.
- [ ] Search Console, Bing e monitor de disponibilidade.
