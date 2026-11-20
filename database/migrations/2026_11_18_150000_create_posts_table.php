<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $isMysql = DB::connection()->getDriverName() === 'mysql';

        Schema::create('posts', function (Blueprint $table) use ($isMysql): void {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('excerpt');
            $table->longText('content');
            $table->string('headline_en')->nullable();
            $table->string('category');
            $table->unsignedBigInteger('region_id')->nullable();
            $table->string('place_type')->nullable();
            $table->unsignedBigInteger('place_id')->nullable();
            $table->string('spoiler_type')->nullable();
            $table->string('reliability');
            $table->unsignedTinyInteger('confidence')->nullable();
            $table->text('basis')->nullable();
            $table->string('source_name')->nullable();
            $table->string('source_url')->nullable();
            $table->string('cover_path')->nullable();
            $table->string('video_path')->nullable();
            $table->string('poster_path')->nullable();
            $table->string('origin');
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status');
            $table->text('reject_reason')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->unsignedTinyInteger('hype')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'published_at']);
            $table->index(['category', 'status']);
            $table->index('region_id');

            if ($isMysql) {
                $table->fullText(['title', 'excerpt']);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
