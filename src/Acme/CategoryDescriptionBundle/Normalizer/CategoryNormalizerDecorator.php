<?php
namespace Acme\CategoryDescriptionBundle\Normalizer;

use Acme\CategoryDescriptionBundle\Repository\CategoryDescriptionRepository;
use Akeneo\Category\Infrastructure\Component\Model\CategoryInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;

final class CategoryNormalizerDecorator implements NormalizerInterface
{
    public function __construct(
        private NormalizerInterface $inner,
        private CategoryDescriptionRepository $repo,
    ) {}

    public function supportsNormalization($data, $format = null, array $context = []): bool
    {
        return $this->inner->supportsNormalization($data, $format, $context);
    }

    public function normalize($object, $format = null, array $context = [])
    {
        $data = $this->inner->normalize($object, $format, $context);

        if ($object instanceof CategoryInterface && is_array($data) && null !== $object->getId()) {
            $data['acme_description'] = $this->repo->find((int) $object->getId());
        }

        return $data;
    }
}
