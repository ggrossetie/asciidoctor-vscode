import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, Memento, Position, TextDocument, Uri } from 'vscode'
import { AntoraSupportManager, getAntoraDocumentContext } from '../antora/antoraSupport'
import { CompletionContextKind, getPathCompletionContext, PathCompletionContext, PathCompletionProvider } from './pathCompletionProvider'
import { AsciiDocTextDocument } from '../AsciiDocTextDocument'
import { AntoraCompletionProvider } from './antoraCompletionProvider'

// Word = [Letter, Mark, Number, Connector_Punctuation]
const attributeRefRx = /(?<!\\)\{(?<name>[\p{L}\p{M}\p{N}\p{Pc}][\p{L}\p{M}\p{N}\p{Pc}-]*)\}/udg

export class ImageCompletionProvider implements CompletionItemProvider {
  private pathCompletionProvider: PathCompletionProvider

  constructor (private readonly workspaceState: Memento) {
    this.pathCompletionProvider = new PathCompletionProvider()
  }

  async provideCompletionItems (textDocument: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionItem[]> {
    const lineText = textDocument.lineAt(position.line).text
    // TODO: check the selection to provide a more accurate completion for instance when the whole target is selected:
    // image::{my-attr} ({my-attr} is selected, in this case we should provide autocompletion for image files at the root, since we will remove/replace {my-attr})
    // TODO: do not provide Antora or path completion when the path is an URL or absolute
    // for instance: image::https: or image::http: or image::file: or image::data:
    const pathCompletionContext = getPathCompletionContext(lineText, position, context)
    if (pathCompletionContext?.kind !== CompletionContextKind.Image) {
      return []
    }
    const antoraSupportManager = await AntoraSupportManager.getInstance(this.workspaceState)
    if (antoraSupportManager.isEnabled()) {
      return provideAntoraCompletionItems(textDocument.uri, pathCompletionContext)
    }
    const asciiDocTextDocument = new AsciiDocTextDocument(textDocument, this.workspaceState)
    const doc = await asciiDocTextDocument.getDocument()
    const imagesDir = doc.getAttribute('imagesdir')
    // TODO: do not add imagesdir when the path is an URL or an absolute path
    if (imagesDir) {
      pathCompletionContext.baseDir = imagesDir
    }
    pathCompletionContext.target = pathCompletionContext.target.replaceAll(attributeRefRx, (match, attributeName) => {
      if (doc.hasAttribute(attributeName)) {
        return doc.getAttribute(attributeName)
      }
      return match
    })
    const result = await this.pathCompletionProvider.provideCompletionItems(textDocument.uri, pathCompletionContext)
    return result
  }
}

async function provideAntoraCompletionItems (textDocumentUri: Uri, pathCompletionContext: PathCompletionContext): Promise<CompletionItem[]> {
  const antoraDocumentContext = await getAntoraDocumentContext(textDocumentUri)
  if (antoraDocumentContext) {
    return AntoraCompletionProvider.provideAntoraResourceIdCompletionItems(antoraDocumentContext.getImages(), pathCompletionContext)
  }
  return []
}
