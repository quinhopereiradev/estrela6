# Funcionalidades (tela a tela)

A referência visual é o protótipo (`reference/prototype/App.jsx`). Componentes citados entre parênteses são os nomes lá.

## Layout geral
- Cabeçalho fixo: logo, busca global (Ctrl+K, `CommandPalette`), Feed, Mapa interativo, Rádio, nível de spoiler (chip), avatar/entrar.
- Rodapé: player da rádio persistente entre páginas (`RadioPlayer`), com AO VIVO / VOLTAR AO VIVO e legenda da locução. Navegação com `wire:navigate` para o áudio não parar.
- Modal de boas-vindas na primeira visita: escolha do preset de spoiler (`SpoilerOnboarding`).
- Toasts de missão com efeito sonoro opcional (`MissionToast`, `sfx.js`).

## Feed {#feed}
- **Dia X** (`DayXBanner`): contagem até `LAUNCH_AT`; "últimas 48 h no portal" (só itens visíveis ao leitor); depois do lançamento vira "Dia N em Leonida".
- Cabeçalho: título, **Enviar artigo** (exige login) e, para moderadores, atalho para a Pauta.
- Filtros: categoria (Todos, Notícias, Teorias, Easter eggs, Shorts), busca (lupa centralizada no campo, altura fixa) e regiões com contagem (só regiões com posts; uma linha no desktop).
- Cards (`FeaturedCard`, `PostCard`): selo de confiabilidade com medidor (`Reliability`, `ConfidenceMeter`), "Ver no mapa · região" quando há lugar, autor "por @apelido" quando veio da comunidade, capa ou SVG gerado, spoiler coberto.
- Vídeos curtos: `<video>` com poster, autoplay mudo no card e controles no modal.
- Página do post: conteúdo em Markdown, caixa de confiabilidade completa (selo, base, fonte), link para o mapa, compartilhar (cartões de imagem 1:1, 9:16, 16:9).
- **Enviar artigo** (`ArticleModal`): título (10+), categoria, região opcional, resumo (30+), texto (200+), fonte (obrigatória em notícia), capa opcional, tipo de spoiler (sem leak), declaração de autoria. Vai para a pauta.

## Mapa {#mapa}
- Painel lateral: região atual + estação que toca nela, busca de locais, atalhos de região, filtro Locais/Pins/Ambos, legenda de categorias com contagem, aba Visual (estilo do mapa), créditos CC BY 4.0.
- Interações: clique esquerdo seleciona região; direito sugere pin; 1 clique abre ficha, 2 cliques vai até o lugar; hover de região com halo; ímã entre regiões.
- Ficha de local: nome, tipo, região, estação da região, compartilhar, link direto.
- Pin da comunidade: título, descrição, foto, autor, "primeiro a descobrir", confirmações, botão "Eu também vi isso".
- Sugerir pin (`SuggestModal`): título, descrição, categoria, foto opcional; aviso de duplicata a < 80 m com atalho para o existente; usuário confiável publica direto.
- Névoa por região para o preset "Às cegas" (`fogged`, revelar região).
- Desempenho: ver skill `mapa-leaflet`.

## Rádio
Ver `05-radio.md`. Página com cartão "Tocando agora", estações, grade da semana (`ScheduleGrid`), controle de locução, botões de prévia (DJ, Comercial, Tempo, News, Recado) e diagnóstico de voz.

## Busca global (Ctrl+K)
Posts, locais, pins e estações; resultados respeitam o spoiler (mostra só "N ocultos"); Enter abre; registra a ação para desafios.

## Contas
- Entrar com Discord ou Google (Socialite). No primeiro login: apelido, confirmação de 16+, aceite dos termos, opção de ser citado nos recados.
- Perfil (`ProfilePage`): avatar, apelido, nível de confiança, posição no ranking, respeito e próxima estrela, desafios diários e semanais, conquistas por categoria, preferências (spoiler, efeitos sonoros), excluir conta (LGPD: apaga dados pessoais e anonimiza contribuições).

## SEO
- URLs em português: `/noticias/{slug}`, `/mapa/local/{id}-{slug}`, `/mapa/pin/{id}`, `/radio/{estacao}`.
- Meta tags e Open Graph seguros (sem spoiler), JSON-LD `NewsArticle` só para posts sem spoiler, `sitemap.xml` sem conteúdo com spoiler, `robots.txt`, canonical, `hreflang` não necessário.
- Páginas renderizadas no servidor (Livewire), Core Web Vitals: LCP < 2,5 s no 4G, imagens com `srcset` e lazy.
- Títulos de página: "<título> · <nome do portal>"; "GTA 6" aparece no conteúdo e nos títulos das páginas, não no nome do site.
