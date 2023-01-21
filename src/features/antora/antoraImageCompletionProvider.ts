import * as vscode from 'vscode'
import { getAntoraDocumentContext } from './antoraSupport'

export default class AntoraImageCompletionProvider {
  constructor (private readonly workspaceState: vscode.Memento) {

  }

  async provideCompletionItems (textDocument: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
    const lineText = textDocument.lineAt(position).text
    const prefix = lineText.substring(position.character - 7, position.character)
    const suffix = lineText.substring(position.character, position.character + 1)
    if (prefix.endsWith('image:') || prefix.endsWith('image::')) {
      // local images
      const antoraDocumentContext = await getAntoraDocumentContext(textDocument.uri, this.workspaceState)
      if (antoraDocumentContext !== undefined) {
        const images = antoraDocumentContext.getImages()
        return images.map((image) => {
          const value = image.basename
          const completionItem = new vscode.CompletionItem({
            label: value,
            description: `${image.src.version}@${image.src.component}:${image.src.module}:${image.src.relative}`,
          }, vscode.CompletionItemKind.Text)
          let insertText = value
          insertText = suffix !== '[' ? `${insertText}[]` : insertText
          completionItem.insertText = insertText
          return completionItem
        })
      }
    }
  }
}
