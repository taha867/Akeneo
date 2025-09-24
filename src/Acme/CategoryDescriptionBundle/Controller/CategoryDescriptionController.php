<?php
declare(strict_types=1);

namespace Acme\CategoryDescriptionBundle\Controller;

use Acme\CategoryDescriptionBundle\Repository\CategoryDescriptionRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\Routing\Annotation\Route;

final class CategoryDescriptionController
{
    public function __construct(private CategoryDescriptionRepository $repo) {}

    // ===== existing description endpoints =====
    //fetch description per locale
    #[Route('/acme/category-description/{id}', name: 'acme_category_description_get', methods: ['GET'])]
    public function get(int $id, Request $request): JsonResponse
    {
        $locale = (string)($request->query->get('locale') ?? 'en_US');
        return new JsonResponse(['description' => $this->repo->find($id, $locale)]);
    }

    //save description per locale
    #[Route('/acme/category-description/{id}', name: 'acme_category_description_put', methods: ['PUT'])]
    public function put(int $id, Request $request): JsonResponse
    {
        $payload = json_decode($request->getContent() ?: '{}', true) ?: [];
        $locale = (string)($payload['locale'] ?? $request->query->get('locale') ?? 'en_US');
        $this->repo->upsert($id, $locale, $payload['description'] ?? null);
        return new JsonResponse(['ok' => true]);
    }

    // ===== NEW: image (GET current url) =====
    //fetch image URL per locale
    #[Route('/acme/category-image/{id}', name: 'acme_category_image_get', methods: ['GET'])]
    public function getImage(int $id, Request $request): JsonResponse
    {
        $locale = (string)($request->query->get('locale') ?? 'en_US');
        return new JsonResponse(['url' => $this->repo->findImageUrl($id, $locale)]);
    }

    // ===== NEW: image (PUT url) =====
    #[Route('/acme/category-image/{id}', name: 'acme_category_image_put', methods: ['PUT'])]
    public function putImage(int $id, Request $request): JsonResponse
    {
        $payload = json_decode($request->getContent() ?: '{}', true) ?: [];
        $locale = (string)($payload['locale'] ?? $request->query->get('locale') ?? 'en_US');
        $url    = isset($payload['url']) && \is_string($payload['url']) ? $payload['url'] : null;
        $this->repo->upsertImageUrl($id, $locale, $url);
        return new JsonResponse(['ok' => true, 'url' => $url]);
    }

    // ===== NEW: image (POST upload) =====
    //upload image; returns URL; saves it
   // ... same namespace/uses and class as you posted ...

   #[Route('/acme/category-image/{id}/upload', name: 'acme_category_image_upload', methods: ['POST'])]
   public function uploadImage(int $id, Request $request): JsonResponse
   {
       $locale = (string)($request->query->get('locale') ?? 'en_US');

       /** @var UploadedFile|null $file */
       $file = $request->files->get('file');
       if (!$file instanceof UploadedFile || !$file->isValid()) {
           return new JsonResponse(['ok' => false, 'error' => 'No file'], 400);
       }

       try {
           // Resolve project root from this file without adding new DI
           $projectRoot = \realpath(\dirname(__DIR__, 4));
           if (false === $projectRoot) {
               throw new \RuntimeException('Cannot resolve project root');
           }

           $targetDir = $projectRoot . '/public/uploads/categories/' . $id;
           if (!is_dir($targetDir) && !@mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
               throw new \RuntimeException('Failed to create upload directory: ' . $targetDir);
           }

           // OPTIONAL: basic size/type guard (adjust as you wish)
           // if ($file->getSize() > 16 * 1024 * 1024) throw new \RuntimeException('File too large');

           // Remove any previous files for this category (clean start policy)
           foreach (@scandir($targetDir) ?: [] as $entry) {
               if ($entry === '.' || $entry === '..') continue;
               @unlink($targetDir . '/' . $entry);
           }

           // Safe name
           $safeName = \preg_replace('/[^a-zA-Z0-9._-]/', '_', $file->getClientOriginalName() ?: 'image');
           $name     = time() . '-' . $safeName;

           // Move file
           $file->move($targetDir, $name);

           // Public URL
           $url = "/uploads/categories/{$id}/{$name}";

           // Persist URL for this (id, locale)
           $this->repo->upsertImageUrl($id, $locale, $url);

           return new JsonResponse(['ok' => true, 'url' => $url], 200);
       } catch (\Throwable $e) {
           // Show the exact cause in the Network response so you can fix quickly
           return new JsonResponse(['ok' => false, 'error' => $e->getMessage()], 500);
       }
   }

}
//Exposes REST endpoints used by the overlay
//Endpoints are bound to routes in config/routes/zz_acme_category_description.yml