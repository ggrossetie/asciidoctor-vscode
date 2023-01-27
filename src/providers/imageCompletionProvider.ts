import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, Memento, Position, ProviderResult, TextDocument } from 'vscode'
import { getAntoraDocumentContext } from '../features/antora/antoraSupport'

interface CompletionAction {
  lineText: string;
  position: Position;
}

export class ImageCompletionProvider implements CompletionItemProvider {
  constructor (private readonly workspaceState: Memento) {
  }

  async provideCompletionItems (textDocument: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionItem[]> {
    const completionAction = this.completionAction(textDocument, position)
    const lineText = completionAction.lineText
    const prefix = lineText.substring(position.character - 7, position.character)
    if (!prefix.endsWith('image:') && !prefix.endsWith('image::')) {
      return []
    }
    const antoraDocumentContext = await getAntoraDocumentContext(textDocument.uri, this.workspaceState)
    if (antoraDocumentContext) {
      return this.provideAntoraImageCompletionItems(antoraDocumentContext, completionAction)
    }
    return []
  }

  private provideAntoraImageCompletionItems (antoraDocumentContext, completionContext: CompletionAction): CompletionItem[] {
    const charPosition = completionContext.position.character
    const suffix = completionContext.lineText.substring(charPosition, charPosition + 1)
    return antoraDocumentContext.getImages().map((image) => {
      const value = image.basename
      const completionItem = new CompletionItem({
        label: value,
        description: `${image.src.version}@${image.src.component}:${image.src.module}:${image.src.relative}`,
      }, CompletionItemKind.Text)
      let insertText = value
      insertText = suffix !== '[' ? `${insertText}[]` : insertText
      completionItem.insertText = insertText
      return completionItem
    })
  }

  private completionAction (textDocument: TextDocument, position: Position): CompletionAction {
    const lineText = textDocument.lineAt(position).text
    return {
      lineText,
      position,
    }
  }
}
