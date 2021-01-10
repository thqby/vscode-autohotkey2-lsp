# vscode-autohotkey2-lsp

AutoHotKey V2 语言支持 for VS Code
  - [调试](#调试)
  - [语言特性](#语言特性)
    - [智能提示](#智能提示)
    - [大纲](#大纲)
    - [转到定义](#转到定义)
    - [查找所有引用](#查找所有引用)
    - [代码标记](#代码标记)
    - [悬停提示](#悬停提示)
    - [代码格式化](#代码格式化)
    - [快捷帮助](#快捷帮助)
  - [上下文菜单](#上下文菜单)
  - [设置](#设置)

## 调试
1. 点击“调试脚本”按钮或按F9.  
2. 支持断点、堆栈、变量监控  
![debug](pic\debug.gif)

**特性:**
1. **输出消息**: 你能使用 `OutputDebug` 命令代替MsgBox.  
![output](pic\output.jpg)
2. **变量监控**: 在调试脚本时设置和获取变量.  
![evalute](pic\evalute.jpg)

这个扩展提供了基本的调试功能. 如果您需要更多的调试功能(Like **conditional breakpoint**), 您可以添加额外的扩展 [vscode-autohotkey-debug](https://marketplace.visualstudio.com/items?itemName=zero-plusplus.vscode-autohotkey-debug).

## 语言特性

### 智能提示

支持对变量、函数和函数参数的智能提示.

![signature](pic\signature.gif)

### 大纲
1. 检索函数、变量的声明信息
2. 您可以在函数、变量的上一行使用分号或/* */向方法添加注释  

![methodSymbol](pic\methodSymbol.jpg)

### 转到定义

1. 支持跳转到方法和变量的定义位置.  
2. 用法: 按住 ctrl 然后移动鼠标到代码处点击.  

![gotoDefinition](pic\gotoDefinition.jpg)

### 查找所有引用

用法: 移动鼠标到方法上, 然后:  
- 右键弹出菜单然后点击 find all references.  
- 或者按 `shift+ctrl+f12`.  

### 代码标记

用法: 在注释代码块中添加两个分号  
![codeSymbole](pic\codeSymbol.jpg)

### 悬停提示  

用法: 移动鼠标到方法上.  
![hover](pic\hover.png)

### 代码格式化  
用法:  
- 右键弹出菜单然后点击 格式化文档.  
- 或按 `Shift+Alt+F`.  

- **代码格式化基于V2语法分析**.  
![codeFormat](pic\codeFormat.gif)

## 快捷帮助  
用法: 移动鼠标到方法上, 然后:  
- 右键弹出菜单点击 语法帮助  
- 或按 `F1`  

- **需设置AHKV2路径**  
![help](pic\quickhelp.png)

## 上下文菜单  
用法: 右键点击弹出菜单, 然后:  
- **运行脚本**: 在不进行调试的情况下运行脚本(快捷键: `Ctrl+F9`).  
- **编译脚本**: 在同一目录中编译脚本(快捷键: `Ctrl+Shift+F9`).  
![compile](pic\compile.jpg)

## 设置  
打开设置 -> 扩展 -> AutoHotkey2  
![settings](pic\settings.jpg)