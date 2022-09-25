import * as vscode from 'vscode'

async function exists(uri: vscode.Uri) {
  try {
    await vscode.workspace.fs.stat(uri)
    return true
  } catch (err) {
    if (err instanceof vscode.FileSystemError.FileNotFound) {
      return false
    }
    throw err
  }
}

export function watchAsciidoctorContentConfig(workspaceState: vscode.Memento) {
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/.asciidoctorconfig",
  )
  watcher.onDidCreate(async (asciidoctorConfigUri) => {
    const workspaceFolder =  vscode.workspace.getWorkspaceFolder(asciidoctorConfigUri)
    if (workspaceFolder === undefined) {
     // ignore
    }
    const asciidoctorConfigContent = new TextDecoder().decode(await vscode.workspace.fs.readFile(asciidoctorConfigUri))
    const key = JSON.stringify({
      "key": "asciidoc.asciidoctorconfig.content",
      "workspaceName": workspaceFolder.name,
      "workspaceIndex": workspaceFolder.index
    })
    workspaceState.update(key, asciidoctorConfigContent)
  })
  watcher.onDidChange(async (asciidoctorConfigUri) => {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(asciidoctorConfigUri)
    if (workspaceFolder === undefined) {
     // ignore
    }
    if (await exists(asciidoctorConfigUri)) {
      const asciidoctorConfigContent = new TextDecoder().decode(await vscode.workspace.fs.readFile(asciidoctorConfigUri))
      const key = JSON.stringify({
        "key": "asciidoc.asciidoctorconfig.content",
        "workspaceName": workspaceFolder.name,
        "workspaceIndex": workspaceFolder.index
      })
      workspaceState.update(key, asciidoctorConfigContent)
    }
  })
  watcher.onDidDelete((asciidoctorConfigUri) => {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(asciidoctorConfigUri)
    if (workspaceFolder === undefined) {
      // ignore
    }
    const key = JSON.stringify({
      "key": "asciidoc.asciidoctorconfig.content",
      "workspaceName": workspaceFolder.name,
      "workspaceIndex": workspaceFolder.index
    })
    workspaceState.update(key, undefined)
  })
}

export async function getAsciidoctorConfigContent(workspaceState: vscode.Memento, documentUri: vscode.Uri): Promise<String | undefined> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri)
  if (workspaceFolder === undefined) {
    return undefined
  }
  const key = JSON.stringify({
    "key": "asciidoc.asciidoctorconfig.content",
    "workspaceName": workspaceFolder.name,
    "workspaceIndex": workspaceFolder.index
  })
  const asciidoctorConfigContent = workspaceState.get<string>(key)
  if (asciidoctorConfigContent !== undefined) {
    return asciidoctorConfigContent
  }
  // todo: add support for .asciidoctorconfig.adoc and
  const asciidoctorConfigUri = vscode.Uri.joinPath(workspaceFolder.uri, '.asciidoctorconfig')
  if (await exists(asciidoctorConfigUri)) {
    const asciidoctorConfigContent = new TextDecoder().decode(await vscode.workspace.fs.readFile(asciidoctorConfigUri))
    workspaceState.update(key, asciidoctorConfigContent)
    return asciidoctorConfigContent
  }
}
