import { CompletionContextKind, getPathCompletionContext, getReference, PathCompletionProvider } from '../pathCompletionProvider'
import { CompletionContext, CompletionTriggerKind, FileType, Position, Range, workspace } from 'vscode'
import { URI } from 'vscode-uri'
import { Mock } from 'jest-mock'

test('relative image path', () => {
  const completionContext = getPathCompletionContext('image::../images/sunset.jpg[Sunset,200,100]', new Position(1, 10), {
    triggerKind: CompletionTriggerKind.Invoke,
    triggerCharacter: undefined,
  })
  expect(completionContext).toEqual({
    context: {
      triggerKind: 0,
      triggerCharacter: undefined,
    },
    position: {
      character: 10,
      line: 1,
    },
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
  const completionContext = getPathCompletionContext('What a beautiful sunset! image:sunset.jpg[Sunset,150,150,role=right]', new Position(1, 33), {
    triggerKind: CompletionTriggerKind.Invoke,
    triggerCharacter: undefined,
  })
  expect(completionContext).toEqual({
    context: {
      triggerKind: 0,
      triggerCharacter: undefined,
    },
    position: {
      character: 33,
      line: 1,
    },
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

test('provide completion items', async () => {
  (workspace.fs.readDirectory as Mock<(uri: URI) => Promise<[string, FileType][]>>).mockReturnValue(Promise.resolve([
    ['index.adoc', FileType.File],
    ['README.adoc', FileType.File],
    ['.gitignore', FileType.File],
    ['index.js', FileType.File],
    ['wave.png', FileType.File],
    ['sunset.jpeg', FileType.File],
    ['sunback.png', FileType.File],
    ['sunbean.jpg', FileType.File],
    ['sunglow.gif', FileType.File],
    ['solar.js', FileType.File],
    ['sun.java', FileType.File],
    ['images', FileType.Directory],
    ['test', FileType.Directory],
    ['lib', FileType.Directory],
  ]))
  const items = await new PathCompletionProvider().provideCompletionItems(URI.file('test.adoc'), {
    kind: CompletionContextKind.Image,
    position: new Position(1, 1),
    context: {
      triggerKind: CompletionTriggerKind.Invoke,
    } as CompletionContext,
    target: 'su',
    macroNameRange: new Range(
      1,
      25,
      1,
      31
    ),
    attributeListStartPosition: new Position(
      1,
      42
    ),
  })
  expect(items.length).toEqual(8)
})

test('get reference', () => {
  expect(getReference('/path/to/dir/')).toEqual('/path/to/dir')
  expect(getReference('/path/to/f')).toEqual('/path/to')
  expect(getReference('')).toEqual('.')
  expect(getReference('.')).toEqual('.')
  expect(getReference('../images/')).toEqual('../images')
  expect(getReference('./src/main/../resources/img/')).toEqual('src/resources/img')
  expect(getReference('', 'images')).toEqual('images')
  expect(getReference('/to/dir/', 'images')).toEqual('images/to/dir')
})
