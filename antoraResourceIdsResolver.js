const ContentCatalog = require('@antora/content-classifier/lib/content-catalog')

const contentCatalog = new ContentCatalog()

contentCatalog.registerComponentVersion('antora', '3.0', {})
contentCatalog.addFile({
  src: {
    component: 'antora',
    version: '3.0',
    module: 'asciidoc',
    family: 'image',
    relative: 'sunset.svg'
  }
})

console.log(contentCatalog)

console.log(contentCatalog.resolveResource('3.0@antora:asciidoc:sunset.svg', {}, 'image', ['image']))

console.log(contentCatalog.resolveResource('sunset.svg', {
  component: 'antora',
  version: '3.0',
  module: 'asciidoc'
}, 'image', ['image']))
