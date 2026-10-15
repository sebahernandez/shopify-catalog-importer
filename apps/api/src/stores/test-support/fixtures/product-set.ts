import { DOC_TAG, type FixtureProvenance } from './fixture-meta.js';

export const provenance: FixtureProvenance = {
  tag: DOC_TAG,
  source: 'https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/productSet',
  assumption:
    'The document was validated against the schema, but no response was recorded. The TAKEN code for a repeated handle, the media status strings and the id formats are assumptions.',
};

const media = [{ id: 'gid://shopify/MediaImage/1', status: 'UPLOADED' }];

/** One product with one variant and one image, as the contract suite creates it. */
export const createdProductBody = {
  data: {
    productSet: {
      product: {
        id: 'gid://shopify/Product/1',
        handle: 'camiseta',
        variants: { nodes: [{ id: 'gid://shopify/ProductVariant/1', sku: 'SKU-1' }] },
        media: { nodes: media },
      },
      userErrors: [],
    },
  },
};

export const handleTakenBody = {
  data: {
    productSet: {
      product: null,
      userErrors: [
        { field: ['input', 'handle'], message: 'Handle has already been taken', code: 'TAKEN' },
      ],
    },
  },
};

/** No product and no user error: the outcome cannot be known. */
export const emptyProductSetBody = { data: { productSet: { product: null, userErrors: [] } } };

export const productSetNullBody = { data: { productSet: null } };

export const unknownMediaStatusBody = {
  data: {
    productSet: {
      ...createdProductBody.data.productSet,
      product: {
        ...createdProductBody.data.productSet.product,
        media: { nodes: [{ id: 'gid://shopify/MediaImage/9', status: 'SOMETHING_NEW' }] },
      },
    },
  },
};

/** A product plus a non-blocking user error. */
export const createdWithUserErrorBody = {
  data: {
    productSet: {
      ...createdProductBody.data.productSet,
      userErrors: [{ field: null, message: 'Heads up', code: null }],
    },
  },
};
