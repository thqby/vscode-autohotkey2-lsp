# vscode-autohotkey2-lsp

AutoHotKey V2 语言支持 for VS Code
  - [语言特性](#语言特性)
    - [智能提示](#智能提示)
    - [大纲](#大纲)
    - [代码标记](#代码标记)
    - [悬停提示](#悬停提示)
    - [转到定义](#转到定义)
    - [代码格式化](#代码格式化)
  - [设置](#设置)

## 语言特性

### 智能提示

支持对变量、函数和函数参数的智能提示.

![signature](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/signature.gif)

### 大纲

1. 在左侧大纲栏目显示函数、变量的声明信息
2. 按Ctrl + P, 输入@符号名检索并跳转
3. 您可以在函数、变量的上一行使用分号或/* */向方法添加注释  

### 代码标记

用法: 在注释代码块中添加两个分号  
![codeSymbole](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/codeSymbol.png)

### 悬停提示  

用法: 移动鼠标到函数上.  
![hover](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/hover.png)

### 转到定义

1. 支持跳转到方法和变量的定义位置.  
2. 用法: 按住 ctrl 然后移动鼠标到代码处点击.  

![gotoDefinition](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/gotoDefinition.png)

### 代码格式化

用法:  
- 右键弹出菜单然后点击 格式化文档.  
- 或按 `Shift+Alt+F`.  

- **代码格式化基于V2语法分析**.  
![codeFormat](https://gitee.com/orz707/vscode-autohotkey2-lsp/raw/master/pic/codeFormat.gif)
