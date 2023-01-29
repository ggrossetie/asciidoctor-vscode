import * as vscode from 'vscode'

import { AsciidocParser } from '../../asciidocParser'

export class AttributeReferenceCompletionProvider {
  provideCompletionItems (textDocument: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const { document } = AsciidocParser.load(textDocument)
    const attributes = document.getAttributes()
    const lineText = textDocument.lineAt(position).text
    const prefixCharacter = lineText.substring(position.character - 1, position.character)
    if (prefixCharacter !== '{') {
      return undefined
    }
    const suffixCharacter = lineText.substring(position.character, position.character + 1)
    return Object.keys(attributes).map((key) => {
      const completionItem = new vscode.CompletionItem({
        label: key,
        description: attributes[key]?.toString(),
      },
      vscode.CompletionItemKind.Variable)
      let insertText = key
      insertText = suffixCharacter !== '}' ? `${insertText}}` : insertText
      completionItem.insertText = insertText
      completionItem.sortText = `20_${key}`
      return completionItem
    })
  }
}
