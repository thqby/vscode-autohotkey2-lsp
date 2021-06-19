## 0.7.7
- 增加解析字符串延续段`(\n'str1\nstr2'\n)`
- 更新语法高亮文件

## 0.7.6
- 增加ahk_h补全项

## 0.7.5
- 修复格式化错误 [#11](https://github.com/thqby/vscode-autohotkey2-lsp/issues/11)
- 修复悬浮提示等不能正常显示与内置函数同名的用户函数

## 0.7.4
- 取消粘贴/键入时自动格式化(editor.formatOnPaste,editor.formatOnType中设置启用)
- 修复无法正确识别某些字符串('string ;comment'...)
- 修复格式化未能识别设置的缩进格式

## 0.7.3
- 粘贴格式化将在字符串/备注中不生效 [#10](https://github.com/thqby/vscode-autohotkey2-lsp/issues/10)
- 修复备注被错误的关联

## 0.7.2
- 增加换行时自动缩进(if/while/loop ...) [#9](https://github.com/thqby/vscode-autohotkey2-lsp/issues/9)
- 变量上一行的注释将对多个变量生效(;...\na:=1, b:=2) [#8](https://github.com/thqby/vscode-autohotkey2-lsp/issues/8#issuecomment-848663235)

## 0.7.1
- 修复变量的注释错乱问题 [#8](https://github.com/thqby/vscode-autohotkey2-lsp/issues/8)
- 修复getter/setter中函数无法显示参数提示
- 注释支持多行格式的(;...\n;...)
- 修复部分class被识别为关键字

## 0.7.0
- 修复bug[#4](https://github.com/thqby/vscode-autohotkey2-lsp/issues/4)
- 修复对象字面量中含有in,and等提示为无效[#7](https://github.com/thqby/vscode-autohotkey2-lsp/issues/7)
- 字符串/备注中不在触发悬浮提示/定义跳转
- 其他bug

## 0.6.9
- 修复悬浮提示/自动补全功能存在堆栈溢出的bug [#3](https://github.com/thqby/vscode-autohotkey2-lsp/issues/3)
- 修复字符串延长段未能正确地结束 [#4](https://github.com/thqby/vscode-autohotkey2-lsp/issues/4)
- 修复部分关键字被标记为错误 [#5](https://github.com/thqby/vscode-autohotkey2-lsp/issues/5)
- 减少.触发的自动补全 [#6](https://github.com/thqby/vscode-autohotkey2-lsp/issues/6)
- 更新高亮文件

## 0.6.8
- 修复继承类的构造函数参数提示错误

## 0.6.7
- 修复继承内置类时, 类型推导错误的问题
- 修复动态属性getter参数多一个的问题
- 修复在动态属性中参数提示无法触发
- 修复快捷帮助偶尔弹出ahk错误

## 0.6.6
- 修复codeinchinese.chineseinputassistant插件(中文代码快速补全)的补全功能失效问题
- 修复在函数名/方法名处无法生成注释模板

## 0.6.5
- 修复函数定义参数值为unset时错误的错误诊断

## 0.6.4
- 同步a133
- 增加一些设置选项
- 增加;TODO:标记

## 0.6.2
- 增加自定义折叠;#region/;#endregion
- 修复部分错误诊断问题
- 修复类动态属性无法折叠的问题

## 0.6.1
- 同步a131

## 0.6.0
- 修复函数调用[]()和()()代码格式化错误地插入空格
- 修复类的属性定义错误的识别为其他类型的同名变量

## 0.5.9
- 大纲中移除函数、方法的参数
- 修复部分补全项丢失

## 0.5.8
- 增加a130补全项

## 0.5.7
- 增加标签重命名和重定义错误诊断

## 0.5.6
- 修复闭包函数内跳转到定义、查找所有引用、符号重命名等不正确的bug

## 0.5.4
- 修复编译脚本在目标exe文件不存在时失败

## 0.5.3
- 修复代码块折叠错误的bug
- 修复代码格式化时, 空{}换行的bug

## 0.5.2
- 增加遗漏的函数补全
- 增加内置函数参数提示信息
- 修复一些bug

## 0.5.0
- 语法解析同步a129
- 增加多文件符号重定义错误诊断

## 0.4.8 (ahk version <= a127)
- 修复类型推导的bug
- 增加参数提示参数说明(@param 参数 说明)抽取显示
- 修复类中的单行方法被识别为函数的bug

## 0.4.6
- 修复一些bug

## 0.4.4
- 增加插件多语言国际化支持(中文,English)
- 增加对AutoHotkey_H版的补全支持
- 增加库函数自动include

## 0.4.3
- 修复一些bug
- 增加debug聚合，一个配置使用其他已安装的debug插件
- 修复代码格式化后无括号函数调用省略参数时,前的空格丢失
- 增加脚本编译功能

## 0.4.2
- 修复一些bug

## 0.4.1

- 修复类型推导的一些bug
- 增加自定义函数的类型推导

## 0.4.0

- 增加简单类型推导，提供相关方法、属性补全
- 增加方法参数提示、定义跳转等支持
- 增加颜色选择器功能
- 增加文件保存时对当前文件信息头(/* ... */)中的版本号、日期自动更新
- 增加查找所用引用和符号重命名(支持变量/函数)

## 0.3.0

- 修复代码格式化的一些bug
- 修复语法解析的一些bug，并增加了一些错误提示
- 增加代码运行功能（支持运行选择部分的代码）
- 增加快速打开帮助功能（AutoHotkey.exe目录下的chm文件），并搜索关键词