# 0001 · Stack: Laravel 13, Livewire 4, Filament 5

- **Status:** aceita
- **Data:** 2026-11-17

## Contexto
O plano original era Laravel 11 + TALL + Filament v3. Em novembro de 2026, o Laravel 11 já não recebe correções de segurança (fim em março de 2026), o Laravel 13 é a versão atual (PHP 8.3+, suporte de segurança até o início de 2028) e o Filament 5 é a versão atual (mesmos recursos do 4, com Livewire 4).

## Decisão
PHP 8.4, Laravel 13, Livewire 4, Alpine, Tailwind 4, Filament 5. A ideia da TALL stack continua; só as versões mudam.

## Alternativas
- Laravel 11 + Filament 3: começaria sem patches de segurança. Recusada.
- Laravel 12: suportado até fevereiro de 2027 só para segurança; atualizaria logo. Recusada.

## Consequências
Documentação e pacotes devem ser os da versão atual (Filament 5 usa a API de Schemas). O Laravel 14 (previsto para o 1º trimestre de 2027, PHP 8.4+) deve ser adotado alguns meses depois do lançamento; PHP 8.4 já prepara isso.
