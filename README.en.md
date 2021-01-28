# vscode-autohotkey2-lsp

AutoHotKey V2 Language support for VS Code, Function realization based on v2 syntax analysis

[简体中文](https://gitee.com/orz707/vscode-autohotkey2-lsp/blob/master/README.md)

- [Language Features](#Language-Features)
  - [Diagnostics](#Diagnostics)
  - [IntelliSense](#IntelliSense)
  - [Signature](#Signature)
  - [Document Symbol](#Document-Symbol)
  - [Blocks](#Blocks)
  - [Hover](#Hover)
  - [Goto Definition](#Goto-Definition)
  - [CodeFormat](#CodeFormat)

## Language Features

### Diagnostics

Simple syntax error diagnosis.

![diagnostics](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/diagnostics.png)

### IntelliSense

Support for scoped variables, functions, parameters, class names, method names, include files, and function library completion.

![snippet1](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/snippet.png)

![snippet2](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/snippet.gif)

### Signature

Support for intelligent prompts for function parameters.

![signature](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/signature.gif)

### Document Symbol

1. Displays class, method, function, variable, label, hotkey, hot string, block information in the left outline column.  
2. press Ctrl + P, Input @symbol_name to retrieve and jump  
3. You can comment a method with a semicolon or /* */ on the top line of a function, variable.  

### Blocks

usage: Add two semicolons to the comment code block.  
![codeSymbole](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/codeSymbol.png)

### Hover  

Supports hover prompts and comments for scoped variables, functions, global classes, and labels.  
usage: Move the mouse over the symbol.  
![hover](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/hover.png)

### Goto Definition

1. Support for jumping to the declaration location of scoped variables, functions, global classes, and labels.  
2. usage: Press ctrl Then move the mouse over to the code and click.  

![gotoDefinition](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/gotoDefinition.png)

### CodeFormat

usage:  

- Right-click the popup menu and click "Format document".  
- or Press `Shift+Alt+F`.  

![codeFormat](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/codeFormat.gif)
