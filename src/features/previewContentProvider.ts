import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { basename, dirname, isAbsolute, join } from 'path';
import { AsciidocEngine } from '../asciidocEngine';

import { Logger } from '../logger';
import { AsciidocPreviewSecurityLevel, ContentSecurityPolicyArbiter } from '../security';
import { AsciidocPreviewConfiguration, AsciidocPreviewConfigurationManager } from './previewConfig';
import { AsciidocContributions } from '../asciidocExtensions';

import { WebviewResourceProvider } from '../util/resources';

const localize = nls.loadMessageBundle();

/**
 * Strings used inside the asciidoc preview.
 *
 * Stored here and then injected in the preview so that they
 * can be localized using our normal localization process.
 */
const previewStrings = {
  cspAlertMessageText: localize(
    'preview.securityMessage.text',
    'Some content has been disabled in this document'),

  cspAlertMessageTitle: localize(
    'preview.securityMessage.title',
    'Potentially unsafe or insecure content has been disabled in the Asciidoc preview. Change the Asciidoc preview security setting to allow insecure content or enable scripts'),

  cspAlertMessageLabel: localize(
    'preview.securityMessage.label',
    'Content Disabled Security Warning'),
};

function escapeAttribute(value: string | vscode.Uri): string {
  return value.toString().replace(/"/g, '&quot;');
}

export class AsciidocContentProvider {
  constructor(
    private readonly engine: AsciidocEngine,
    private readonly context: vscode.ExtensionContext,
    private readonly cspArbiter: ContentSecurityPolicyArbiter,
    private readonly contributions: AsciidocContributions,
    private readonly logger: Logger
  ) {
  }

  public async providePreviewHTML(
    asciidocDocument: vscode.TextDocument,
    resourceProvider: WebviewResourceProvider,
    previewConfigurations: AsciidocPreviewConfigurationManager,
    initialLine: number | undefined = undefined,
    state?: any
  ): Promise<string> {
    const sourceUri = asciidocDocument.uri;
    const config = previewConfigurations.loadAndCacheConfiguration(sourceUri);
    const initialData = {
      source: sourceUri.toString(),
      line: initialLine,
      lineCount: asciidocDocument.lineCount,
      scrollPreviewWithEditor: config.scrollPreviewWithEditor,
      scrollEditorWithPreview: config.scrollEditorWithPreview,
      doubleClickToSwitchToEditor: config.doubleClickToSwitchToEditor,
      disableSecurityWarnings: this.cspArbiter.shouldDisableSecurityWarnings(),
      webviewResourceRoot: resourceProvider.asWebviewUri(sourceUri).toString(),
    };

    // Content Security Policy
    const nonce = getNonce();
    const csp = this.getCsp(resourceProvider, sourceUri, nonce);

    const body = await this.engine.render(sourceUri, config.previewFrontMatter === 'hide', asciidocDocument.getText());
    const bodyClassesRegex = /<body(?:\s+(?:id=\".*"\s*)?class\s*=\s*(?:\"(.+?)\"|\'(.+?)\'))+\s*>/
    const bodyClasses = body.match(bodyClassesRegex)
    const bodyClassesVal = bodyClasses === null ? '' : bodyClasses[1];

    return `<!DOCTYPE html>
  <html>
    <head>
      <meta http-equiv="Content-type" content="text/html;charset=UTF-8">
      ${csp}
      <meta id="vscode-markdown-preview-data"
        data-settings="${escapeAttribute(JSON.stringify(initialData))}"
        data-strings="${escapeAttribute(JSON.stringify(previewStrings))}"
        data-state="${escapeAttribute(JSON.stringify(state || {}))}">
      <script src="${this.extensionResourcePath(resourceProvider, 'pre.js')}" nonce="${nonce}"></script>
      ${this.getStyles(resourceProvider, sourceUri, nonce, config, state)}
      <base href="${asciidocDocument.uri.with({scheme: 'vscode-resource'}).toString(true)}">
    </head>
    <body class="${bodyClassesVal} vscode-body ${config.scrollBeyondLastLine ? 'scrollBeyondLastLine' : ''} ${config.wordWrap ? 'wordWrap' : ''} ${config.markEditorSelection ? 'showEditorSelection' : ''}">
      ${body}
      <div class="code-line" data-line="${asciidocDocument.lineCount}"></div>
      ${this.getScripts(resourceProvider, nonce)}
    </body>
  </html>`;
  }

  private extensionResourcePath(resourceProvider: WebviewResourceProvider, mediaFile: string): string {
    const webviewResource = resourceProvider.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', mediaFile));
    return webviewResource.toString();
  }

  private fixHref(resourceProvider: WebviewResourceProvider, resource: vscode.Uri, href: string): string {
    if (!href) {
      return href;
    }

    if (href.startsWith('http:') || href.startsWith('https:') || href.startsWith('file:')) {
      return href;
    }

    // Assume it must be a local file
    if (isAbsolute(href)) {
      return resourceProvider.asWebviewUri(vscode.Uri.file(href)).toString();
    }

    // Use a workspace relative path if there is a workspace
    const root = vscode.workspace.getWorkspaceFolder(resource);
    if (root) {
      return resourceProvider.asWebviewUri(vscode.Uri.joinPath(root.uri, href)).toString();
    }

    // Otherwise look relative to the markdown file
    return resourceProvider.asWebviewUri(vscode.Uri.file(join(dirname(resource.fsPath), href))).toString();
  }

  private computeCustomStyleSheetIncludes(resourceProvider: WebviewResourceProvider, resource: vscode.Uri, config: AsciidocPreviewConfiguration): string {
    if (!Array.isArray(config.styles)) {
      return '';
    }
    const out: string[] = [];
    for (const style of config.styles) {
      out.push(`<link rel="stylesheet" class="code-user-style" data-source="${escapeAttribute(style)}" href="${escapeAttribute(this.fixHref(resourceProvider, resource, style))}" type="text/css" media="screen">`);
    }
    return out.join('\n');
  }

  private getSettingsOverrideStyles(nonce: string, config: AsciidocPreviewConfiguration): string {
    return `<style nonce="${nonce}">
      body {
        ${config.fontFamily ? `font-family: ${config.fontFamily};` : ''}
        ${isNaN(config.fontSize) ? '' : `font-size: ${config.fontSize}px;`}
        ${isNaN(config.lineHeight) ? '' : `line-height: ${config.lineHeight};`}
      }
    </style>`;
  }

  private getImageStabilizerStyles(state?: any) {
    let ret = '<style>\n';
    if (state && state.imageInfo) {
      state.imageInfo.forEach((imgInfo: any) => {
        ret += `#${imgInfo.id}.loading {
          height: ${imgInfo.height}px;
          width: ${imgInfo.width}px;
        }\n`;
      });
    }
    ret += '</style>\n';

    return ret;
  }

  private getStyles(resourceProvider: WebviewResourceProvider, resource: vscode.Uri, nonce: string, config: AsciidocPreviewConfiguration, state?: any): string {
    const useEditorStyle = vscode.workspace.getConfiguration('asciidoc', null).get('preview.useEditorStyle')
    var baseStyles;
    if (useEditorStyle) {
      baseStyles = this.contributions.previewStylesEditor
        .map((resource) => `<link rel="stylesheet" type="text/css" href="${escapeAttribute(resourceProvider.asWebviewUri(resource))}">`)
        .join('\n');
    } else {
      baseStyles = this.contributions.previewStylesDefault
        .map((resource) => `<link rel="stylesheet" type="text/css" href="${escapeAttribute(resourceProvider.asWebviewUri(resource))}">`)
        .join('\n');
    }

    return `${baseStyles}
      ${this.getSettingsOverrideStyles(nonce, config)}
      ${this.computeCustomStyleSheetIncludes(resourceProvider, resource, config)}
      ${this.getImageStabilizerStyles(state)}`;
  }

  private getScripts(resourceProvider: WebviewResourceProvider, nonce: string): string {
    const out: string[] = [];
    for (const resource of this.contributions.previewScripts) {
      out.push(`<script async
				src="${escapeAttribute(resourceProvider.asWebviewUri(resource))}"
				nonce="${nonce}"
				charset="UTF-8"></script>`);
    }
    return out.join('\n');
  }

  private getCsp(
    provider: WebviewResourceProvider,
    resource: vscode.Uri,
    nonce: string
  ): string {
    const rule = provider.cspSource;
    switch (this.cspArbiter.getSecurityLevelForResource(resource)) {
      case AsciidocPreviewSecurityLevel.AllowInsecureContent:
        return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' ${rule} http: https: data:; media-src 'self' ${rule} http: https: data:; script-src 'nonce-${nonce}'; style-src 'self' ${rule} 'unsafe-inline' http: https: data:; font-src 'self' ${rule} http: https: data:;">`;

      case AsciidocPreviewSecurityLevel.AllowInsecureLocalContent:
        return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' ${rule} https: data: http://localhost:* http://127.0.0.1:*; media-src 'self' ${rule} https: data: http://localhost:* http://127.0.0.1:*; script-src 'nonce-${nonce}'; style-src 'self' ${rule} 'unsafe-inline' https: data: http://localhost:* http://127.0.0.1:*; font-src 'self' ${rule} https: data: http://localhost:* http://127.0.0.1:*;">`;

      case AsciidocPreviewSecurityLevel.AllowScriptsAndAllContent:
        return '<meta http-equiv="Content-Security-Policy" content="">';

      case AsciidocPreviewSecurityLevel.Strict:
      default:
        return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' ${rule} https: data:; media-src 'self' ${rule} https: data:; script-src 'nonce-${nonce}'; style-src 'self' ${rule} 'unsafe-inline' https: data:; font-src 'self' ${rule} https: data:;">`;
    }
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 64; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
