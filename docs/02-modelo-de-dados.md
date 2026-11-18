# Modelo de dados

Convenções: `id` bigint, `timestamps()` em tudo, `softDeletes()` em conteúdo da comunidade, enums PHP com cast. Nomes em inglês.

## Contas
**users**: `name` (apelido único), `email` nulo, `avatar_url`, `provider` (`discord|google`), `provider_id`, `role` (`member|editor|moderator|admin`), `age_confirmed_at` (16+), `terms_accepted_at`, `spoiler_preset` (`oficial|cego|tudo`), `spoiler_overrides` json, `revealed_regions` json, `mod_safe_mode` bool default **true**, `cite_name` bool (aparecer nos recados da rádio), `banned_at`.

## Feed
**posts**: `title`, `slug` único, `excerpt`, `content` (Markdown), `headline_en` (para a rádio), `category` (`noticia|teoria|easter-egg|video`), `region_id` nulo, `place_type`/`place_id` (landmark ou pin, nulo), `spoiler_type` nulo, `reliability` (`oficial|comunidade|rumor|nao-verificado`), `confidence` tinyint nulo, `basis` (texto do porquê do selo), `source_name`, `source_url`, `cover_path`, `video_path`, `poster_path`, `origin` (`staff|community|collector`), `author_id` nulo, `status` (`draft|pending|published|rejected`), `reject_reason`, `published_at`, `hype` tinyint.
Índices: `(status, published_at)`, `(category, status)`, `region_id`, fulltext `(title, excerpt)`.

**collected_items** (coleta automática): `source_id`, `external_id` único por fonte, `url`, `raw_title`, `raw_excerpt`, `fetched_at`, `relevance` (0–1, IA), `suggested` json (categoria, região, spoiler, selo), `post_id` nulo (rascunho gerado), `status` (`new|drafted|discarded`).
**sources**: `name`, `kind` (`rss|youtube|page`), `url`, `tier` (`oficial|imprensa|comunidade`), `auto_publish` bool, `active`, `last_checked_at`, `etag`.

## Mapa
Do pacote `reference/laravel-leonida`: **map_landmarks**, **map_landmark_overrides**, **map_regions**, **map_sync_runs**.
**markers** (pins): `title`, `description`, `category` (`easter-egg|veiculo|segredo|missao`), `x`, `y` (decimal metros), `region_id`, `spoiler_type` (derivado da categoria, com override), `image_path`, `author_id`, `status` (`pending|approved|rejected`), `reject_reason`, `is_first_discovery`, `approved_at`, `approved_by`.
**marker_confirmations**: `marker_id`, `user_id`, único no par.

## Rádio
**stations**: `slug`, `name`, `frequency`, `genre`, `color`, `sort`.
**shows**: `station_id`, `name`, `host`, `kind` (`musica|falado|comunidade`), `starts_at_hour`, `ends_at_hour`.
**tracks**: `station_id`, `title`, `artist`, `host_name`, `audio_path`, `duration_seconds`, `energy` (0–1), `license` (sempre `CC0 1.0`), `source`, `source_url`, `is_active`.
**radio_briefings**: `date` único, `items` json, `generated_at`.
**bulletins**: `station_id`, `date`, `slot`, `title`, `audio_url`, `duration`, `transcript` json, `model`, `tts`, `status` (`pending|published|rejected`).
**listener_messages** (recados): `user_id`, `station_id`, `text`, `status`.

## Gamificação
**respect_ledger**: `user_id`, `amount` (pode ser negativo), `reason` (enum), `subject_type`/`subject_id`, `note`. Único `(user_id, reason, subject_type, subject_id)`.
**user_stats**: `user_id` PK, contadores (`pins_approved`, `articles_approved`, `confirms_given`, `confirms_received`, `first_discoveries`, `landmarks_visited`, `listen_minutes`, `news_heard`, `shares`, `searches`, `days_active`…), `flags` json (segredos).
**achievements** (catálogo, via seeder): `key`, `category`, `tier`, `title`, `description`, `stat`, `goal`, `secret`.
**user_achievements**: `user_id`, `achievement_key`, `unlocked_at`.
**challenge_progress**: `user_id`, `scope` (`daily|weekly`), `period_key`, `challenge_key`, `progress`, `completed_at`.

## Moderação geral
**reports** (denúncias): `reportable` morph, `user_id`, `reason`, `status`.
**moderation_log**: quem, o quê, ação, motivo, quando (auditoria; nunca exibir o conteúdo no modo seguro).
