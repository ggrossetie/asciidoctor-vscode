import { DefinitionProvider, Definition, Range, Position, Uri, LocationLink, TextDocument, CancellationToken, DefinitionLink } from 'vscode'

export default class ImageDefinitionProvider implements DefinitionProvider {
  public async provideDefinition (document: TextDocument, position: Position, token: CancellationToken): Promise<Definition | LocationLink[]> {
    return [{
      targetUri: Uri.file('/Users/guillaumegrossetie/dev/opensource/asciidoctor-vscode/test-workspace/antora/multiComponents/cli/modules/commands/images/seaswell.png'),
      targetRange: new Range(new Position(0, 0), new Position(0, 0)),
    } as DefinitionLink]
  }
}
