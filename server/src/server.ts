import {
   createConnection,
   TextDocuments,
   InitializeParams,
   CompletionItem,
   CompletionItemKind,
   TextDocumentPositionParams,
   TextDocumentSyncKind,
} from "vscode-languageserver/node"

import { PublishDiagnosticsClientCapabilities } from "vscode-languageserver-protocol"

import { TextDocument } from "vscode-languageserver-textdocument"

import { lex } from "./lex"

const connection = createConnection()

// Client capabilities
const client: {
   publishDiagnostics?: PublishDiagnosticsClientCapabilities
} = {}

connection.onInitialize((params: InitializeParams) => {
   // Keep track of relevant client capabilities.
   client.publishDiagnostics = params.capabilities.textDocument?.publishDiagnostics
   // Return server capabilities.
   return {
      capabilities: {
         textDocumentSync: TextDocumentSyncKind.Incremental,
         //completionProvider: { resolveProvider: true },
      },
   }
})

connection.onInitialized(() => {
   console.log("Connection has been initialized 🦄.")
})

// ------------------------------ Document handling --------------------------------

const documents = new TextDocuments(TextDocument)
// Listen for text document events.
documents.listen(connection)
// Called when the document is opened, and every time it is modified.
documents.onDidChangeContent(({ document }) => {
   let { ast, diagnostics } = lex(document.getText())
   connection.sendDiagnostics({ uri: document.uri, diagnostics })
})

// ------------------------------ Example functionality ---------------------------------

// Provide a list of completion items at the given position.
// connection.onCompletion((pos: TextDocumentPositionParams): CompletionItem[] => {
//    return [
//       {
//          label: "TypeScript",
//          kind: CompletionItemKind.Text,
//          data: 1,
//       },
//       {
//          label: "JavaScript",
//          kind: CompletionItemKind.Text,
//          data: 2,
//       },
//    ]
// })

// // Provide additional information for the selected completion item.
// connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
//    if (item.data === 1) {
//       item.detail = "TypeScript details"
//       item.documentation = "TypeScript documentation"
//    } else if (item.data === 2) {
//       item.detail = "JavaScript details"
//       item.documentation = "JavaScript documentation"
//    }
//    return item
// })

// Begin listening for messages.
connection.listen()
