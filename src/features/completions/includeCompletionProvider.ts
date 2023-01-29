import { CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, Memento, Position, TextDocument, Uri } from 'vscode'
import { CompletionContextKind, getPathCompletionContext, PathCompletionContext, PathCompletionProvider } from './pathCompletionProvider'
import { AntoraSupportManager, getAntoraDocumentContext } from '../antora/antoraSupport'
import { AntoraCompletionProvider } from './antoraCompletionProvider'

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
    return AntoraCompletionProvider.provideAntoraResourceIdCompletionItems(antoraDocumentContext.getIncludeCompatibleFiles(), pathCompletionContext)
  }
  return []
}
