# Spoilers e moderação

As regras de implementação e o checklist ficam na skill `.claude/skills/spoiler-safety/SKILL.md`. Este documento descreve o produto.

## Proteção do leitor
- Três presets: **Só o oficial** (padrão, esconde leaks), **Às cegas** (esconde história, segredos e leaks; mapa em névoa) e **Quero tudo**. Ajuste fino por tipo no perfil.
- Conteúdo oculto aparece como "conteúdo oculto · revelar" (revelação pontual, não muda o preset).
- Mídia vazada nunca é hospedada nem incorporada.

## Proteção do moderador: modo seguro
Ligado por padrão para todo usuário com papel de moderação. Nas filas de pins e de artigos:

| Aparece | Fica oculto |
|---|---|
| mini-mapa, região, local conhecido mais próximo, coordenadas | título |
| autor, nível de confiança, respeito | descrição / texto / resumo |
| data de envio, origem (comunidade ou coleta) | imagem / capa |
| fonte (domínio e link) | categoria e tags |
| checagem automática (tamanho, palavrões, cópia, imagem, "IA: pode conter spoiler") | sugestão de tema da IA |
| duplicatas como contagem ("1 pin a menos de 80 m") | títulos das duplicatas |

Ações disponíveis sem revelar: **Ver só o ponto no mapa** (marca um alvo genérico, sem abrir o pin), **Aprovar/Publicar**, **Recusar com motivo**, **Revelar só este item**.
Fluxo pensado para pins: o moderador vai até o ponto no próprio jogo, confere com os olhos e aprova sem ler.

## Filas
### Pins
Entram como `pending`, exceto de usuários confiáveis. Motivos de recusa: Duplicado, Sem evidência, Localização errada, Leak ou spoiler indevido, Conteúdo ofensivo, Spam. Aprovar concede pontos; recusar notifica o autor com o motivo (texto sem título).

### Pauta do feed
Origem: artigos da comunidade, rascunhos da coleta automática e posts da equipe. Ao publicar, o moderador escolhe o selo (Confirmado, Comunidade, Rumor, Não verificado). Motivos de recusa de artigo: Fonte fraca ou ausente, Duplicado, Leak ou spoiler indevido, Cópia de outro site, Fora do tema, Precisa de revisão de texto. Artigo da comunidade publicado: +30 de respeito para o autor.

## Coleta automática (feed que se alimenta sozinho)
```
Fontes (RSS/YouTube/páginas) ─► sources:check (a cada 30 min)
   ─► filtro barato por palavra-chave (gta, leonida, vice city, rockstar…) — descarta a maioria sem IA
   ─► Haiku: relevância, categoria, região, risco de spoiler, selo sugerido (JSON validado)
   ─► relevância ≥ 0,6: Haiku escreve rascunho em PT-BR com nossas palavras + headline_en + link da fonte
   ─► posts.status = pending (origem collector) ─► Pauta (modo seguro) ─► você publica
```
- Fontes oficiais (`tier = oficial`, `auto_publish = true`) podem ir direto ao ar com selo Confirmado.
- Orçamento: `AI_DAILY_BUDGET_USD`; ao estourar, o job para e avisa no admin. Estimativa: poucos dólares por mês sem filtro, menos de 1 dólar com o filtro por palavra-chave.
- Deduplicação: URL canônica + similaridade de título com posts dos últimos 7 dias.
- Nunca copiar texto da fonte; nunca publicar imagem da fonte.

### Fontes iniciais
| Nível | Fontes |
|---|---|
| Oficial | página Newswire da Rockstar (monitorar a página: não há RSS oficial confirmado), RSS do canal da Rockstar no YouTube, comunicados da Take-Two |
| Imprensa | IGN, GameSpot, VGC, Eurogamer, PC Gamer, Kotaku; IGN Brasil, Voxel/TecMundo, The Enemy, Adrenaline |
| Comunidade (Rumor/Comunidade) | r/GTA6 (RSS), GTAForums (RSS), GTABase, atualizações do GTADB, canais de criadores no YouTube (RSS) |
| Evitar | leakers no X (API paga e conteúdo arriscado), sites caça-clique |
