import * as path from "path"
import * as vscode from "vscode"
import {
   NodeModule,
   LanguageClient,
   LanguageClientOptions,
   ServerOptions,
   TransportKind,
} from "vscode-languageclient/node"

let client: LanguageClient

// This method is called when the extension is activated for the first time.
// The extension is activated when a Monolog file is opened, or when a command defined by the extension is invoked.
export function activate(context: vscode.ExtensionContext) {
   console.log("The Monolog extension (client) has been activated.")

   // --------------------------- Example: registering a command -----------------------------
   // Implementation of the command "monolog.helloWorld" that was declared in package.json.
   // let disposable = vscode.commands.registerCommand(
   //    "monolog.helloWorld",
   //    () => {
   //       vscode.window.showInformationMessage("Command activated!")
   //    }
   // )
   // context.subscriptions.push(disposable)

   // ---------------------------- Starting the language server ------------------------------

   // Discussion about which transport option(s) to use can be found here:
   //     https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#implementationConsiderations
   // Basically, there are three options:
   //   - stdio
   //   - TCP sockets
   //   - "pipes" (these are apparently called "pipes" on Windows and "socket files" on Unix)
   //   - And if the server is running Node, then communication can also occur over "Node IPC".
   // Stdio is the simplest.

   const module: NodeModule = {
      module: context.asAbsolutePath(path.join("server", "out", "server.js")), // Compiled server
      transport: TransportKind.ipc,
   }
   const serverOptions: ServerOptions = {
      run: module, // What to invoke when the extension has been launched in run mode.
      debug: module, // What to invoke when the extension has been launched in debug mode.
   }
   const clientOptions: LanguageClientOptions = {
      // Register the server for Monolog files. (I'm not sure what this actually does. I'm just filling out the template.)
      documentSelector: [{ scheme: "file", language: "monolog" }],
      // Notify the server about file changes to .foo files contained in the workspace (as an example).
      //synchronize: { fileEvents: vscode.workspace.createFileSystemWatcher("**/.foo")  },
   }

   // Start the client. This will also launch the server.
   client = new LanguageClient(
      "monolog-language-client",
      "Monolog Language Client", // Name for display purposes.
      serverOptions,
      clientOptions
   )
   client.start()
}

export function deactivate() {
   if (client) return client.stop()
}
