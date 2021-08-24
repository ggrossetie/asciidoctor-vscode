/*---------------------------------------------------------------------------------------------
  *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as path from 'path';
import { OpenDocumentLinkCommand } from '../commands/openDocumentLink';
import { getUriForLinkWithKnownExternalScheme, isOfScheme, Schemes } from '../util/links';

const localize = nls.loadMessageBundle();

function parseLink(
  document: vscode.TextDocument,
  link: string,
): { uri: vscode.Uri, tooltip?: string } | undefined {
  const externalSchemeUri = getUriForLinkWithKnownExternalScheme(link);
  if (externalSchemeUri) {
    // Normalize VS Code links to target currently running version
    if (isOfScheme(Schemes.vscode, link) || isOfScheme(Schemes['vscode-insiders'], link)) {
      return { uri: vscode.Uri.parse(link).with({ scheme: vscode.env.uriScheme }) };
    }
    return { uri: externalSchemeUri };
  }

  // Assume it must be an relative or absolute file path
  // Use a fake scheme to avoid parse warnings
  const tempUri = vscode.Uri.parse(`vscode-resource:${link}`);

  let resourceUri: vscode.Uri | undefined;
  if (!tempUri.path) {
    resourceUri = document.uri;
  } else if (tempUri.path[0] === '/') {
    const root = getWorkspaceFolder(document);
    if (root) {
      resourceUri = vscode.Uri.joinPath(root, tempUri.path);
    }
  } else {
    if (document.uri.scheme === Schemes.untitled) {
      const root = getWorkspaceFolder(document);
      if (root) {
        resourceUri = vscode.Uri.joinPath(root, tempUri.path);
      }
    } else {
      const base = document.uri.with({ path: path.dirname(document.uri.fsPath) });
      resourceUri = vscode.Uri.joinPath(base, tempUri.path);
    }
  }

  if (!resourceUri) {
    return undefined;
  }

  resourceUri = resourceUri.with({ fragment: tempUri.fragment });

  return {
    uri: OpenDocumentLinkCommand.createCommandUri(document.uri, resourceUri, tempUri.fragment),
    tooltip: localize('documentLink.tooltip', 'Follow link')
  };
}

function getWorkspaceFolder(document: vscode.TextDocument) {
  return vscode.workspace.getWorkspaceFolder(document.uri)?.uri
    || vscode.workspace.workspaceFolders?.[0]?.uri;
}

function matchAll(
  pattern: RegExp,
  text: string
): Array<RegExpMatchArray> {
  const out: RegExpMatchArray[] = [];
  pattern.lastIndex = 0;
  let match: RegExpMatchArray | null;
  while ((match = pattern.exec(text))) {
    out.push(match);
  }
  return out;
}

export default class LinkProvider implements vscode.DocumentLinkProvider {
  private readonly linkPattern = /(?<!\\)(link:)([^\s\[]+)\[((?:\\\]|[^\]])*?)\]/g;

  public provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.DocumentLink[] {
    const base = path.dirname(document.uri.fsPath);
    const text = document.getText();

    return this.providerInlineLinks(text, document, base);
  }

  private providerInlineLinks(
    text: string,
    document: vscode.TextDocument,
    base: string
  ): vscode.DocumentLink[] {
    const results: vscode.DocumentLink[] = [];
    for (const match of matchAll(this.linkPattern, text)) {
      const pre = match[1];
      const link = match[2];
      const offset = (match.index || 0) + pre.length;
      const linkStart = document.positionAt(offset);
      const linkEnd = document.positionAt(offset + link.length);
      try {
        const linkData = parseLink(document, link);
        if (linkData) {
          results.push(new vscode.DocumentLink(new vscode.Range(linkStart, linkEnd), linkData.uri));
        }
      } catch (e) {
        // noop
      }
    }

    return results;
  }
}
