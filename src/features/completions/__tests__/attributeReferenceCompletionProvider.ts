import { CompletionTriggerKind, Position } from 'vscode'
import { getAttributeReferenceCompletionContext } from '../attributeReferenceCompletionProvider'

test('getAttributeReferenceCompletionContext', () => {
  const ctx = getAttributeReferenceCompletionContext('Hello {name}', new Position(1, 7), {
    triggerKind: CompletionTriggerKind.Invoke,
    triggerCharacter: '',
  })
  expect(ctx).toEqual({
    attributeName: '',
    context: {
      triggerCharacter: '',
      triggerKind: 0,
    },
    position: {
      character: 7,
      line: 1,
    },
    startPosition: {
      character: 6,
      line: 1,
    },
    endPosition: {
      character: 11,
      line: 1,
    },
    endCharacter: '}',
  })
})
