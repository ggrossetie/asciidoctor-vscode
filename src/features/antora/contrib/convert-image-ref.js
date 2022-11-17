'use strict'

function convertImageRef (resourceSpec, currentPage, contentCatalog) {
  const image = contentCatalog.resolveResource(resourceSpec, currentPage.src, 'image', ['image'])
  if (image) return image.src?.abspath
}

module.exports = convertImageRef
