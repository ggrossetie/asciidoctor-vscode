import { CompletionItem, CompletionItemKind, CompletionItemProvider, Position, TextDocument } from 'vscode'
import { PathCompletionContext } from './pathCompletionProvider'
import { getAttributes } from '../antora/antoraSupport'

interface AntoraFile {
  basename: string,
  src: {
    version: string,
    component: string,
    module: string,
    relative: string,
  }
}

export default class AntoraAsciiDocAttributesCompletionProvider implements CompletionItemProvider {
  async provideCompletionItems (textDocument: TextDocument, position: Position): Promise<CompletionItem[]> {
    const lineText = textDocument.lineAt(position).text
    const prefixCharacter = lineText.substring(position.character - 1, position.character)
    if (prefixCharacter !== '{') {
      return undefined
    }
    const suffixCharacter = lineText.substring(position.character, position.character + 1)
    const attributes = await getAttributes(textDocument.uri)
    return Object.entries(attributes).map(([key, value]) => {
      const completionItem = new CompletionItem({
        label: key,
        description: value,
      }, CompletionItemKind.Text)
      let insertText = value
      insertText = suffixCharacter !== '}' ? `${insertText}}` : insertText
      completionItem.insertText = insertText
      return completionItem
    })
  }
}

export class AntoraCompletionProvider {
  static provideAntoraResourceIdCompletionItems (files: AntoraFile[], pathCompletionContext: PathCompletionContext): CompletionItem[] {
    return files.map((file) => {
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
}
