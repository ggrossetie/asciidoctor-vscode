import { getPathCompletionContext } from '../pathCompletionProvider'
import { Position } from 'vscode'

test('relative image path', () => {
  const completionContext = getPathCompletionContext('image::../images/sunset.jpg[Sunset,200,100]', new Position(1, 10))
  expect(completionContext).toEqual({
    kind: 'image',
    target: '../',
    macroNameRange: {
      startLine: 1,
      startCharacter: 0,
      endLine: 1,
      endCharacter: 7,
    },
    attributeListStartPosition: {
      line: 1,
      character: 28,
    },
  })
})

test('inline image', () => {
  const completionContext = getPathCompletionContext('What a beautiful sunset! image:sunset.jpg[Sunset,150,150,role=right]', new Position(1, 33))
  expect(completionContext).toEqual({
    kind: 'image',
    target: 'su',
    macroNameRange: {
      startLine: 1,
      startCharacter: 25,
      endLine: 1,
      endCharacter: 31,
    },
    attributeListStartPosition: {
      line: 1,
      character: 42,
    },
  })
})
