<?php
declare(strict_types=1);

namespace Acme\CategoryDescriptionBundle\Repository;

use Doctrine\DBAL\Connection;

final class CategoryDescriptionRepository
{
    public function __construct(private Connection $conn) {}

    // ========== DESCRIPTION (you already have these) ==========
    // returns description string or null.
    public function find(int $categoryId, string $locale): ?string
    {
        $sql = 'SELECT description FROM acme_category_description WHERE category_id = :id AND locale = :locale';
        $desc = $this->conn->fetchOne($sql, ['id' => $categoryId, 'locale' => $locale]);
        return false === $desc ? null : (string)$desc;
    }

    //inserts/updates description and updated_at.
    public function upsert(int $categoryId, string $locale, ?string $description): void
    {
        $this->conn->executeStatement(
            'INSERT INTO acme_category_description (category_id, locale, description, updated_at)
             VALUES (:id, :locale, :d, NOW())
             ON DUPLICATE KEY UPDATE description = VALUES(description), updated_at = NOW()',
            ['id' => $categoryId, 'locale' => $locale, 'd' => $description]
        );
    }

    // ========== IMAGE (new) ==========
    // returns stored image URL (from images_json).
    public function findImageUrl(int $categoryId, string $locale): ?string
{
    $url = $this->conn->fetchOne(
        'SELECT images_json FROM acme_category_description WHERE category_id = :id AND locale = :locale',
        ['id' => $categoryId, 'locale' => $locale]
    );

    if (false === $url || null === $url || '' === $url) {
        return null;
    }
    return (string)$url; // plain relative URL string, e.g. /uploads/categories/161/foo.png
}

public function upsertImageUrl(int $categoryId, string $locale, ?string $url): void
{
    $this->conn->executeStatement(
        'INSERT INTO acme_category_description (category_id, locale, images_json, updated_at)
         VALUES (:id, :locale, :url, NOW())
         ON DUPLICATE KEY UPDATE images_json = VALUES(images_json), updated_at = NOW()',
        ['id' => $categoryId, 'locale' => $locale, 'url' => $url]
    );
}
}
//Thin DBAL helper around table acme_category_description.