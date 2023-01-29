import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, Memento, Position, TextDocument, Uri } from 'vscode'
import { CompletionContextKind, getPathCompletionContext, PathCompletionContext, PathCompletionProvider } from './pathCompletionProvider'
import { AntoraDocumentContext, AntoraSupportManager, getAntoraDocumentContext } from '../antora/antoraSupport'

export class IncludeCompletionProvider implements CompletionItemProvider {
  private pathCompletionProvider: PathCompletionProvider

  constructor (private readonly workspaceState: Memento) {
    this.pathCompletionProvider = new PathCompletionProvider()
  }

  async provideCompletionItems (textDocument: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionItem[]> {
    const lineText = textDocument.lineAt(position.line).text
    const pathCompletionContext = getPathCompletionContext(lineText, position, context)
    if (pathCompletionContext?.kind !== CompletionContextKind.Include) {
      return []
    }
    const antoraSupportManager = await AntoraSupportManager.getInstance(this.workspaceState)
    if (antoraSupportManager.isEnabled()) {
      return provideAntoraCompletionItems(textDocument.uri, pathCompletionContext)
    }
    const result = await this.pathCompletionProvider.provideCompletionItems(textDocument.uri, pathCompletionContext)
    return result
  }
}

async function provideAntoraCompletionItems (textDocumentUri: Uri, pathCompletionContext: PathCompletionContext): Promise<CompletionItem[]> {
  const antoraDocumentContext = await getAntoraDocumentContext(textDocumentUri)
  if (antoraDocumentContext) {
    return provideAntoraFileCompletionItems(antoraDocumentContext, pathCompletionContext)
  }
  return []
}

function provideAntoraFileCompletionItems (antoraDocumentContext: AntoraDocumentContext, pathCompletionContext: PathCompletionContext): CompletionItem[] {
  return antoraDocumentContext.getIncludeCompatibleFiles().map((file) => {
    const value = file.basename
    const completionItem = new CompletionItem({
      label: value,
      description: `${file.src.version}@${file.src.component}:${file.src.module}:${file.src.relative}`,
    }, CompletionItemKind.Text)
    let insertText = value
    insertText = pathCompletionContext.attributeListStartPosition ? insertText : `${insertText}[]`
    completionItem.insertText = insertText
    return completionItem
  })
}
