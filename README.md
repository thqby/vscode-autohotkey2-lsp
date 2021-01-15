# vscode-autohotkey2-lsp

AutoHotKey V2 语言支持 for VS Code, 功能实现基于v2语法分析

- [语言特性](#语言特性)
  - [代码补全](#代码补全)
  - [智能提示](#智能提示)
  - [大纲](#大纲)
  - [代码标记](#代码标记)
  - [悬停提示](#悬停提示)
  - [转到定义](#转到定义)
  - [代码格式化](#代码格式化)

## 语言特性

### 代码补全

支持对作用域范围内的变量、函数、参数，支持对类名、方法名、include文件和函数库补全.

![snippet1](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/snippet.png)

![snippet2](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/snippet.gif)

### 智能提示

支持对函数参数的智能提示.

![signature](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/signature.gif)

### 大纲

1. 在左侧大纲栏目显示类、方法、函数、变量、标签、热键、热字串、区块信息  
2. 按Ctrl + P, 输入@符号名检索并跳转  
3. 您可以在函数、变量的上一行使用分号或/* */向方法添加注释  

### 代码标记

用法: 在注释代码块中添加两个分号  
![codeSymbole](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/codeSymbol.png)

### 悬停提示  

支持对作用域范围内变量、函数、全局类、标签的悬停提示并显示相关备注.  
用法: 移动鼠标到相关符号上.  
![hover](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/hover.png)

### 转到定义

1. 支持跳转到作用域范围内变量、函数、全局类、标签的声明位置.  
2. 用法: 按住 ctrl 然后移动鼠标到代码处点击.  

![gotoDefinition](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/gotoDefinition.png)

### 代码格式化

用法:  

- 右键弹出菜单然后点击 格式化文档.  
- 或按 `Shift+Alt+F`.  
  
  
![codeFormat](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/codeFormat.gif)
