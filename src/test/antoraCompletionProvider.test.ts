import { Position, Uri, workspace } from 'vscode'
import 'mocha'
import assert from 'assert'
import AntoraAsciiDocAttributesCompletionProvider from '../features/completions/antoraCompletionProvider'

let root

suite('Antora CompletionsProvider', () => {
  setup(() => {
    root = workspace.workspaceFolders[0].uri.fsPath
  })
  test('Should return completion items', async () => {
    const provider = new AntoraAsciiDocAttributesCompletionProvider()
    const file = await workspace.openTextDocument(Uri.file(`${root}/antora/multiComponents/api/modules/auth/pages/jwt/page2.adoc`))
    const completionsItems = await provider.provideCompletionItems(file, new Position(3, 1))
    assert.deepStrictEqual(completionsItems[0].label, {
      description: 'asciidoc@',
      label: 'source-language',
    })
    assert.strictEqual(completionsItems[0].insertText, '{asciidoc@}')
    assert.deepStrictEqual(completionsItems[1].label, {
      description: 'short@',
      label: 'xrefstyle',
    })
    assert.strictEqual(completionsItems[1].insertText, '{short@}')
    assert.deepStrictEqual(completionsItems[2].label, {
      description: false,
      label: 'example-caption',

    })
    assert.strictEqual(completionsItems[2].insertText, '{false}')
  })
})
