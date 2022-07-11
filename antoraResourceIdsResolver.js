import ContentCatalog from '@antora/content-classifier/lib/content-catalog'

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
