define([], function () {
  return {
    config: {
      paths: {
        'acme/category/field/description': 'acmecategorydescription/js/fields/category-description'
      },
      'pim/form-builder': {
        extensions: [
          {
            name: 'acme-category-description',
            targetZone: 'properties',               // shows on the “Properties” tab
            module: 'acme/category/field/description',
            meta: {label: 'pim_common.description'},
            config: {}
          }
        ]
      }
    }
  };
});
