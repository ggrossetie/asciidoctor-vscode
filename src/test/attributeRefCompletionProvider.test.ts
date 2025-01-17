import 'mocha'
import * as vscode from 'vscode'
import assert from 'assert'
import { AttributeReferenceProvider } from '../features/attributeReferenceProvider'
import { Position } from 'vscode'
import { createFile } from './workspaceHelper'

function filterByLabel (label: string): (CompletionItem) => boolean {
  return (item) => {
    if ((item.label as vscode.CompletionItemLabel)) {
      return (item.label as vscode.CompletionItemLabel).label === label
    }
    return false
  }
}

async function findCompletionItems (uri: vscode.Uri, position: vscode.Position, filter?: (completionItem) => boolean) {
  const textDocument = await vscode.workspace.openTextDocument(uri)
  const completionsItems = new AttributeReferenceProvider().provideCompletionItems(textDocument, position)
  if (filter) {
    return completionsItems.filter(filter)
  }
  return completionsItems
}

suite('Attribute ref CompletionsProvider', () => {
  let createdFiles: vscode.Uri[] = []
  teardown(async () => {
    for (const createdFile of createdFiles) {
      await vscode.workspace.fs.delete(createdFile)
    }
    createdFiles = []
  })
  test('Should return attribute key defined in same file', async () => {
    const fileToAutoComplete = await createFile('fileToAutoComplete-attributeRef-samefile.adoc', `:my-attribute-to-find-in-completion: dummy value
`)
    createdFiles.push(fileToAutoComplete)
    const items = await findCompletionItems(fileToAutoComplete, new Position(1, 0), filterByLabel('my-attribute-to-find-in-completion'))
    const completionItem = items[0]
    assert.deepStrictEqual((completionItem.label as vscode.CompletionItemLabel).description, 'dummy value')
    assert.deepStrictEqual(completionItem.insertText, '{my-attribute-to-find-in-completion}')
  })
  test('Should return attribute key defined in same file corresponding to its value', async () => {
    const fileToAutoComplete = await createFile('fileToAutoComplete-attributeRef.adoc', `:my-attribute-to-find-in-completion: dummy value
dumm`)
    createdFiles.push(fileToAutoComplete)
    const items = await findCompletionItems(fileToAutoComplete, new Position(1, 3), filterByLabel('my-attribute-to-find-in-completion'))
    const completionItem = items[0]
    assert.deepStrictEqual((completionItem.label as vscode.CompletionItemLabel).description, 'dummy value')
    assert.deepStrictEqual(completionItem.insertText, '{my-attribute-to-find-in-completion}')
  })
  test('Should return no completion when nothing corresponds', async () => {
    const fileToAutoComplete = await createFile('fileToAutoComplete-attributeRef-samefile-basedOnValue.adoc', `:my-attribute-to-find-in-completion: dummy value
somethingVeryDifferent`)
    createdFiles.push(fileToAutoComplete)
    const items = await findCompletionItems(fileToAutoComplete, new Position(1, 22))
    assert.notStrictEqual(items.length, 0, 'There are completion provided although none are expected.')
  })
  test('Should return attribute key defined in another file', async () => {
    const fileToAutoComplete = await createFile('fileToAutoComplete-attributeRef-differentFile.adoc', `= test
include::file-referenced-with-an-attribute.adoc[]


    `)
    createdFiles.push(fileToAutoComplete)
    const fileReferencedWithAnAttribute = await createFile('file-referenced-with-an-attribute.adoc', ':my-attribute-to-find-in-completion: dummy value')
    createdFiles.push(fileReferencedWithAnAttribute)
    const items = await findCompletionItems(fileToAutoComplete, new Position(3, 0), filterByLabel('my-attribute-to-find-in-completion'))
    const completionItem = items[0]
    assert.deepStrictEqual((completionItem.label as vscode.CompletionItemLabel).description, 'dummy value')
    assert.deepStrictEqual(completionItem.insertText, '{my-attribute-to-find-in-completion}')
  })
  test('Should disable auto-completion on literal paragraph', async () => {
    const fileToAutoComplete = await createFile('disable-autocompletion-literal-paragraph.adoc', `= test
:fn-type: pure

 function foo() {

The above function is {
    `)
    createdFiles.push(fileToAutoComplete)
    let items = await findCompletionItems(fileToAutoComplete, new Position(3, 17))
    assert.deepStrictEqual(items.length, 0, 'should not provide attributes completion on literal paragraphs.')

    items = await findCompletionItems(fileToAutoComplete, new Position(5, 1))
    assert.deepStrictEqual(items.length > 0, true, 'should provide attribute completion on paragraphs.')
  })
  test('Should disable auto-completion on verbatim blocks', async () => {
    const fileToAutoComplete = await createFile('disable-autocompletion-verbatim-blocks.adoc', `= test
:app-version: 1.2.3

----
function foo() {
----

[listing]
function foo() {

....
function foo() {
  function bar() {
}
....

[literal]
function foo() {

[source,xml,subs=+attributes]
----
<dependency>
  <groupId>org.asciidoctor</groupId>
  <artifactId>asciidoctor-vscode</artifactId>
  <version>{</version>
</dependency>
----

Install version {
    `)
    createdFiles.push(fileToAutoComplete)
    let completionsItems = await findCompletionItems(fileToAutoComplete, new Position(4, 16))
    assert.deepStrictEqual(completionsItems.length, 0, 'should not provide attributes completion on source blocks.')

    completionsItems = await findCompletionItems(fileToAutoComplete, new Position(8, 16))
    assert.deepStrictEqual(completionsItems.length, 0, 'should not provide attributes completion on listing blocks.')

    completionsItems = await findCompletionItems(fileToAutoComplete, new Position(12, 18))
    assert.deepStrictEqual(completionsItems.length, 0, 'should not provide attributes completion on listing blocks (indented).')

    completionsItems = await findCompletionItems(fileToAutoComplete, new Position(17, 16))
    assert.deepStrictEqual(completionsItems.length, 0, 'should not provide attributes completion on literal blocks.')

    completionsItems = await findCompletionItems(fileToAutoComplete, new Position(24, 12))
    assert.deepStrictEqual(completionsItems.length > 0, true, 'should provide attribute completion verbatim blocks with attributes subs.')

    completionsItems = await findCompletionItems(fileToAutoComplete, new Position(28, 17))
    assert.deepStrictEqual(completionsItems.length > 0, true, 'should provide attribute completion on paragraphs.')
  })
})
