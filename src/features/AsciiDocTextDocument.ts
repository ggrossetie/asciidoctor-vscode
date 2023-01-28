import { Memento, TextDocument } from 'vscode'
import { AntoraSupportManager } from './antora/antoraSupport'
import { getAsciidoctorConfigContent } from './asciidoctorConfig'
import { Asciidoctor } from '@asciidoctor/core'

const asciidoctor = require('@asciidoctor/core')
const processor = asciidoctor()

export class AsciiDocTextDocument {
  private readonly prependExtension: Asciidoctor.Extensions.Preprocessor

  constructor (readonly textDocument: TextDocument, readonly workspaceState: Memento) {
    this.prependExtension = processor.Extensions.createPreprocessor('PreprendConfigPreprocessorExtension', {
      postConstruct: function () {
        this.asciidoctorConfigContent = ''
      },
      process: function (doc, reader) {
        if (this.asciidoctorConfigContent.length > 0) {
          // otherwise an empty line at the beginning breaks level 0 detection
          reader.pushInclude(this.asciidoctorConfigContent, undefined, undefined, 1, {})
        }
      },
    }).$new()
  }

  async getDocument (): Promise<Asciidoctor.Document> {
    const antoraSupport = await AntoraSupportManager.getInstance(this.workspaceState)
    const antoraAttributes = await antoraSupport.getAttributes(this.textDocument.uri)
    const asciidoctorConfigContent = await getAsciidoctorConfigContent(this.textDocument.uri)
    const registry = processor.Extensions.create()
    if (asciidoctorConfigContent !== undefined) {
      (this.prependExtension as any).asciidoctorConfigContent = asciidoctorConfigContent
      registry.preprocessor(this.prependExtension)
    }
    const options: { [key: string]: any } = {
      attributes: {
        ...antoraAttributes,
      },
      extension_registry: registry,
    }
    return processor.load(this.textDocument.getText(), options)
  }
}
