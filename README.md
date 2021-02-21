# AutoHotkey2语言支持

Turn down the pages of the [English](#Language-support-for-AutoHotkey2-for-Visual-Studio-Code) version of README

AutoHotKey V2 语言支持 for VS Code, 功能实现基于v2语法分析

- [语言特性](#语言特性)
  - [重命名符号](#重命名符号)
  - [错误诊断](#错误诊断)
  - [智能感知](#智能感知)
  - [智能提示](#智能提示)
  - [大纲](#大纲)
  - [代码标记](#代码标记)
  - [颜色提示](#颜色提示)
  - [悬停提示](#悬停提示)
  - [转到定义](#转到定义)
  - [查找所有引用](#查找所有引用)
  - [代码格式化](#代码格式化)

## 语言特性

### 重命名符号

作用域范围内的变量、函数名批量重命名.

![rename](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/rename.gif)
### 错误诊断

简单语法错误诊断.

![diagnostics](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/diagnostics.png)

### 智能感知

支持对作用域范围内的变量、函数、参数、类名、方法名智能补全(简单的类型推导)，支持对include文件和函数库补全.

![snippet1](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/snippet.png)

![snippet2](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/snippet.gif)

### 智能提示

支持对函数、方法参数的智能提示.

![signature](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/signature.gif)

### 大纲

1. 在左侧大纲栏目显示类、方法、函数、变量、标签、热键、热字串、区块信息  
2. 按Ctrl + P, 输入@符号名检索并跳转  
3. 您可以在函数、变量的上一行使用分号或/* */向方法添加注释  

### 代码标记

用法: 在注释代码块中添加两个分号  
![codeSymbole](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/codeSymbol.png)

### 颜色提示

计算并解析文档中的颜色，并提供颜色选择器更直观地修改颜色数据。

![documentcolor](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/documentcolor.png)

### 悬停提示  

支持对作用域范围内变量、函数、全局类、标签的悬停提示并显示相关备注.  
用法: 移动鼠标到相关符号上.  
![hover](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/hover.png)

### 转到定义

1. 支持跳转到作用域范围内变量、函数、全局类、标签的声明位置.  
2. 用法: 按住 ctrl 然后移动鼠标到代码处点击.  

![gotoDefinition](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/gotoDefinition.png)

### 查找所有引用

查看正在使用某个变量/函数的所有源代码位置。

### 代码格式化

用法:  

- 右键弹出菜单然后点击 格式化文档.  
- 或按 `Shift+Alt+F`.  

![codeFormat](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/codeFormat.gif)

# Language support for AutoHotkey2 for Visual Studio Code

AutoHotKey V2 Language support for VS Code, Function realization based on v2 syntax analysis

- [Language Features](#Language-Features)
  - [Rename Symbol](#Rename-Symbol)
  - [Diagnostics](#Diagnostics)
  - [IntelliSense](#IntelliSense)
  - [Signature](#Signature)
  - [Document Symbol](#Document-Symbol)
  - [Blocks](#Blocks)
  - [Document Color](#Document-Color)
  - [Hover](#Hover)
  - [Goto Definition](#Goto-Definition)
  - [Find All References](#Find-All-References)
  - [CodeFormat](#CodeFormat)

## Language Features

### Rename Symbol

Rename variables and function names in the scope in batches.

![rename](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/rename.gif)

### Diagnostics

Simple syntax error diagnosis.

![diagnostics](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/diagnostics.png)

### IntelliSense

Supports intelligent completion of variables, functions, parameters, class names, and method names within the scope (by simple type deduction), and supports the completion of include files and function libraries.

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

### Document Color

Compute and resolve colors inside a document to provide color picker in editor.

![documentcolor](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/documentcolor.png)

### Hover  

Supports hover prompts and comments for scoped variables, functions, global classes, and labels.  
usage: Move the mouse over the symbol.  
![hover](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/hover.png)

### Goto Definition

1. Support for jumping to the declaration location of scoped variables, functions, global classes, and labels.  
2. usage: Press ctrl Then move the mouse over to the code and click.  

![gotoDefinition](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/gotoDefinition.png)

### Find All References

See all the source code locations where a certain variable/function is being used.

### CodeFormat

usage:  

- Right-click the popup menu and click "Format document".  
- or Press `Shift+Alt+F`.  

![codeFormat](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/codeFormat.gif)
