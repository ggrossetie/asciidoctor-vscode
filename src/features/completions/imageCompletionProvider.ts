import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, Memento, Position, TextDocument, Uri } from 'vscode'
import { AntoraSupportManager, getAntoraDocumentContext } from '../antora/antoraSupport'
import { CompletionContextKind, getPathCompletionContext, PathCompletionContext, PathCompletionProvider } from './pathCompletionProvider'
import { AsciiDocTextDocument } from '../AsciiDocTextDocument'

export class ImageCompletionProvider implements CompletionItemProvider {
  private pathCompletionProvider: PathCompletionProvider

  constructor (private readonly workspaceState: Memento) {
    this.pathCompletionProvider = new PathCompletionProvider()
  }

  async provideCompletionItems (textDocument: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionItem[]> {
    const lineText = textDocument.lineAt(position.line).text
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
    if (imagesDir) {
      pathCompletionContext.baseDir = imagesDir
    }
    const result = await this.pathCompletionProvider.provideCompletionItems(textDocument.uri, pathCompletionContext)
    return result
  }
}

async function provideAntoraCompletionItems (textDocumentUri: Uri, pathCompletionContext: PathCompletionContext): Promise<CompletionItem[]> {
  const antoraDocumentContext = await getAntoraDocumentContext(textDocumentUri)
  if (antoraDocumentContext) {
    return provideAntoraImageCompletionItems(antoraDocumentContext, pathCompletionContext)
  }
  return []
}

function provideAntoraImageCompletionItems (antoraDocumentContext, pathCompletionContext: PathCompletionContext): CompletionItem[] {
  return antoraDocumentContext.getImages().map((image) => {
    const value = image.basename
    const completionItem = new CompletionItem({
      label: value,
      description: `${image.src.version}@${image.src.component}:${image.src.module}:${image.src.relative}`,
    }, CompletionItemKind.Text)
    let insertText = value
    insertText = pathCompletionContext.attributeListStartPosition ? insertText : `${insertText}[]`
    completionItem.insertText = insertText
    return completionItem
  })
}
