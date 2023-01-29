import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, Position, TextDocument } from 'vscode'
import { AsciidocParser } from '../../asciidocParser'

// Word = [Letter, Mark, Number, Connector_Punctuation]
const attributeRefRx = /.*(?<!\\)(?<start>\{)(?<name>[\p{L}\p{M}\p{N}\p{Pc}][\p{L}\p{M}\p{N}\p{Pc}-]*|)(?<end>$|\s|\})/ud

export interface AttributeReferenceCompletionContext {

  readonly context: CompletionContext

  readonly position: Position

  readonly attributeName: string

  readonly startPosition: Position

  readonly endPosition?: Position

  readonly endCharacter?: string
}

export class AttributeReferenceCompletionProvider implements CompletionItemProvider {
  provideCompletionItems (textDocument: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): CompletionItem[] {
    const attrRefCompletionContext = getAttributeReferenceCompletionContext(textDocument.lineAt(position.line).text, position, context)
    if (!attrRefCompletionContext) {
      return undefined
    }
    const { document } = AsciidocParser.load(textDocument)
    const attributes = document.getAttributes()
    return Object.entries(attributes).map(([key, value]) => {
      const completionItem = new CompletionItem(
        {
          label: key,
          description: value.toString(),
        },
        CompletionItemKind.Variable
      )
      let insertText = key
      insertText = attrRefCompletionContext.endCharacter !== '}' ? `${insertText}}` : insertText
      completionItem.insertText = insertText
      completionItem.sortText = `20_${key}`
      return completionItem
    })
  }

  static provideCompletionItems (attributes: { [key: string]: any }, attributeReferenceCompletionContext: AttributeReferenceCompletionContext) {
    return Object.keys(attributes).map((key) => {
      const completionItem = new CompletionItem(
        {
          label: key,
          description: attributes[key]?.toString(),
        },
        CompletionItemKind.Variable
      )
      completionItem.insertText = attributeReferenceCompletionContext.endCharacter === '}'
        ? key
        : `${key}}`
      completionItem.sortText = `20_${key}`
      return completionItem
    })
  }
}

export function getAttributeReferenceCompletionContext (lineText: string, position: Position, completionContext: CompletionContext)
  : AttributeReferenceCompletionContext | undefined {
  const found = lineText.match(attributeRefRx)
  if (found) {
    if ('indices' in found) {
      // indices not available on type
      const end = found.groups.end
      const startIdx = (found as any).indices.groups.start
      // const nameIdx = (found as any).indices.groups.name
      const endIdx = (found as any).indices.groups.end
      return {
        context: completionContext,
        position,
        attributeName: '',
        startPosition: new Position(position.line, startIdx[0]),
        endPosition: endIdx
          ? new Position(position.line, endIdx[0])
          : undefined,
        endCharacter: end !== null
          ? end || ''
          : undefined,
      }
    }
  }
  return undefined
}
