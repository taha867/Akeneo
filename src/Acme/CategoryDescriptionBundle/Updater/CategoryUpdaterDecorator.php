<?php
namespace Acme\CategoryDescriptionBundle\Updater;

use Acme\CategoryDescriptionBundle\Repository\CategoryDescriptionRepository;
use Akeneo\Category\Infrastructure\Component\Model\CategoryInterface;
use Akeneo\Tool\Component\StorageUtils\Updater\ObjectUpdaterInterface;

class CategoryUpdaterDecorator implements ObjectUpdaterInterface
{
    public function __construct(
        private ObjectUpdaterInterface $inner,
        private CategoryDescriptionRepository $repo
    ) {
    }

    /** @param CategoryInterface $object */
    public function update($object, array $data, array $options = [])
    {
        // Run core updater first
        $this->inner->update($object, $data, $options);

        // Persist our description if provided
        if ($object instanceof CategoryInterface && \array_key_exists('description', $data)) {
            $locale = $options['locale'] ?? $data['locale'] ?? null;

            if ($locale && $object->getId()) {
                $this->repo->upsert(
                    (int) $object->getId(),
                    (string) $locale,
                    (string) $data['description']
                );
            }
        }
    }

    // Some core updaters expose validate(); support it if present
    public function validate($object, array $data, array $options = [])
    {
        if (\method_exists($this->inner, 'validate')) {
            return $this->inner->validate($object, $data, $options);
        }

        return [];
    }
}
