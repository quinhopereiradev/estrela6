<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Locais vindos da fonte (GTADB). Nunca são apagados: somem da fonte => is_active = false.
        Schema::create('map_landmarks', function (Blueprint $table) {
            $table->id();
            $table->string('source_id', 32)->unique();       // ID estável da fonte, ex.: "L13"
            $table->string('name');
            $table->string('district')->nullable();
            $table->string('area')->nullable();
            $table->string('region', 32)->nullable()->index(); // vice-city, leonida-keys, ...
            $table->string('type', 24)->index();               // safehouse, posto, hotel, ...
            $table->unsignedTinyInteger('tier')->default(2);   // 1 = sempre visível
            $table->boolean('enterable')->default(false);
            $table->boolean('unconfirmed')->default(false);     // escondido no filtro "sem leaks"
            $table->boolean('closed')->default(false);
            $table->double('x');                                // metros do jogo (L.CRS.Simple: lng)
            $table->double('y');                                // metros do jogo (L.CRS.Simple: lat)
            $table->string('real_world')->nullable();          // inspiração na vida real
            $table->boolean('is_active')->default(true)->index();
            $table->string('source_sha', 40)->nullable();
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
        });

        // Ajustes feitos no painel admin. A sincronização NUNCA escreve aqui.
        Schema::create('map_landmark_overrides', function (Blueprint $table) {
            $table->id();
            $table->string('source_id', 32)->unique();
            $table->string('name')->nullable();
            $table->string('type', 24)->nullable();
            $table->unsignedTinyInteger('tier')->nullable();
            $table->enum('spoiler_type', ['historia', 'easter', 'leak'])->nullable();
            $table->boolean('hidden')->default(false);
            $table->text('notes')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('map_regions', function (Blueprint $table) {
            $table->string('id', 32)->primary();
            $table->string('name');
            $table->string('station', 24);                     // estação da Rádio Leonida
            $table->string('color', 9);
            $table->integer('label_x');
            $table->integer('label_y');
            $table->json('polygons');                          // [[[x,y],...], ...] em metros
            $table->timestamps();
        });

        // Cada execução do comando: o que mudou, prévia e status da revisão.
        Schema::create('map_sync_runs', function (Blueprint $table) {
            $table->id();
            $table->enum('status', ['running', 'nothing_new', 'pending_review', 'published', 'rejected', 'failed'])->index();
            $table->string('landmarks_sha', 40)->nullable();
            $table->string('tiles_sha', 40)->nullable();
            $table->string('tileset', 32)->nullable();
            $table->unsignedInteger('tiles_version')->nullable(); // vira /storage/map/tiles/v{N}
            $table->string('staging_path')->nullable();
            $table->json('summary')->nullable();                // contagens + exemplos para o Filament
            $table->longText('log')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('map_sync_runs');
        Schema::dropIfExists('map_regions');
        Schema::dropIfExists('map_landmark_overrides');
        Schema::dropIfExists('map_landmarks');
    }
};
