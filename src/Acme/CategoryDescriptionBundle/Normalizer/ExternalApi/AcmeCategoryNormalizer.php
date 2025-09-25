<?php
declare(strict_types=1);

namespace Acme\CategoryDescriptionBundle\Normalizer\ExternalApi;

use Acme\CategoryDescriptionBundle\Repository\CategoryDescriptionRepository;
use Akeneo\Category\Infrastructure\Component\Classification\Model\CategoryInterface;
use Symfony\Component\Serializer\Normalizer\CacheableSupportsMethodInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;

/**
 * Decorates Akeneo external_api category normalizer to inject custom fields.
 */
final class AcmeCategoryNormalizer implements NormalizerInterface, CacheableSupportsMethodInterface
{
    public function __construct(
        private NormalizerInterface $innerNormalizer,
        private CategoryDescriptionRepository $repository
    ) {
    }

    public function normalize($object, $format = null, array $context = []): array
    {
        /** @var array $payload */
        $payload = $this->innerNormalizer->normalize($object, $format, $context);

        if (!$object instanceof CategoryInterface) {
            return $payload;
        }

        $locale = $this->resolveLocale($context);
        $categoryId = (int) $object->getId();

        $description = null;
        $imageUrl = null;
        try {
            $description = $this->repository->find($categoryId, $locale);
        } catch (\Throwable $e) {
            // keep null
        }
        try {
            $imageUrl = $this->repository->findImageUrl($categoryId, $locale);
        } catch (\Throwable $e) {
            // keep null
        }

        // Inject under a dedicated namespace to avoid collisions
        $payload['extensions']['acme_category'] = [
            'locale' => $locale,
            'description' => $description,
            'image' => $imageUrl,
        ];

        return $payload;
    }

    public function supportsNormalization($data, $format = null): bool
    {
        return $data instanceof CategoryInterface && 'external_api' === $format
            && $this->innerNormalizer->supportsNormalization($data, $format);
    }

    public function hasCacheableSupportsMethod(): bool
    {
        return method_exists($this->innerNormalizer, 'hasCacheableSupportsMethod')
            ? (bool) $this->innerNormalizer->hasCacheableSupportsMethod()
            : true;
    }

    private function resolveLocale(array $context): string
    {
        // Common places where locale might be provided
        foreach (['locale', 'ui_locale', 'channelLocale'] as $key) {
            if (isset($context[$key]) && is_string($context[$key]) && $context[$key] !== '') {
                return $context[$key];
            }
        }
        // Fallback to UI lang attribute when available (Symfony request stack is not available here)
        return 'en_US';
    }
}


